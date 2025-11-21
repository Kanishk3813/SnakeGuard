import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { requireAdminUser } from '@/lib/admin-auth';

interface UpdateStepsPayload {
  steps_state: {
    id: string;
    completed: boolean;
    note?: string;
  }[];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminUser(request);
    const assignmentId = params.id;
    const { steps_state } = (await request.json()) as UpdateStepsPayload;

    if (!Array.isArray(steps_state)) {
      return NextResponse.json({ error: 'steps_state array required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('incident_assignments')
      .select('steps_state')
      .eq('id', assignmentId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const updatedSteps = current.steps_state.map((step: any) => {
      const incoming = steps_state.find(s => s.id === step.id);
      if (!incoming) return step;
      return {
        ...step,
        completed: incoming.completed,
        note: incoming.note ?? step.note,
        completed_at: incoming.completed ? new Date().toISOString() : null,
      };
    });

    const completedCount = updatedSteps.filter((s: any) => s.completed).length;
    const status = completedCount === updatedSteps.length ? 'completed' : 'active';

    const { data, error } = await supabaseAdmin
      .from('incident_assignments')
      .update({
        steps_state: updatedSteps,
        status,
      })
      .eq('id', assignmentId)
      .select('*, playbook:incident_playbooks(*)')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Update steps error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update steps' },
      { status: 500 }
    );
  }
}

