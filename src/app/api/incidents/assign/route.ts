import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { IncidentPlaybook, IncidentAssignmentStepState } from '@/types';
import { requireAdminUser } from '@/lib/admin-auth';

interface AssignPayload {
  detectionId: string;
  species?: string | null;
  riskLevel?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const { detectionId, species, riskLevel } = (await request.json()) as AssignPayload;
    if (!detectionId || !riskLevel) {
      return NextResponse.json(
        { error: 'detectionId and riskLevel are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const playbook = await findMatchingPlaybook(supabaseAdmin, riskLevel, species);

    if (!playbook) {
      return NextResponse.json({ error: 'No playbook configured for this risk level' }, { status: 404 });
    }

    const stepsState: IncidentAssignmentStepState[] = playbook.steps.map(step => ({
      id: step.id,
      title: step.title,
      completed: false,
    }));

    const { data: assignment, error } = await supabaseAdmin
      .from('incident_assignments')
      .upsert(
        {
          detection_id: detectionId,
          playbook_id: playbook.id,
          steps_state: stepsState,
          status: 'active',
        },
        { onConflict: 'detection_id' }
      )
      .select('*, playbook:incident_playbooks(*)')
      .single();

    if (error) throw error;
    return NextResponse.json({ data: assignment });
  } catch (error: any) {
    console.error('Assign playbook error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to assign playbook' },
      { status: 500 }
    );
  }
}

async function findMatchingPlaybook(
  supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>,
  riskLevel: string,
  species?: string | null
): Promise<IncidentPlaybook | null> {
  const { data: candidates, error } = await supabaseAdmin
    .from('incident_playbooks')
    .select('*')
    .eq('risk_level', riskLevel);

  if (error || !candidates?.length) {
    return null;
  }

  const normalizedDetection = normalizeSpecies(species);

  if (normalizedDetection) {
    const speciesMatch = candidates.find(pb => pb.species && normalizeSpecies(pb.species) === normalizedDetection);
    if (speciesMatch) {
      return speciesMatch;
    }
  }

  const generic = candidates.find(pb => !pb.species || pb.species.trim() === '');
  if (generic) return generic;

  return candidates[0];
}

function normalizeSpecies(value?: string | null) {
  if (!value) return null;
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

