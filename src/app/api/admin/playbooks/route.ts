import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { IncidentPlaybook } from '@/types';
import { generateId } from '@/lib/id';

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('incident_playbooks')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    const message = error?.message || 'Unable to fetch playbooks';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser(request);
    const payload = (await request.json()) as IncidentPlaybook;
    const supabaseAdmin = getSupabaseAdminClient();

    const record = normalizePlaybookPayload(payload);
    record.id = record.id || generateId();
    record.created_by = user.id;

    const { data, error } = await supabaseAdmin
      .from('incident_playbooks')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    const message = error?.message || 'Unable to create playbook';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function normalizePlaybookPayload(payload: IncidentPlaybook) {
  return {
    id: payload.id,
    title: payload.title?.trim() || 'Untitled Playbook',
    risk_level: payload.risk_level,
    species: payload.species?.trim() || null,
    description: payload.description || null,
    first_aid: payload.first_aid || null,
    created_by: payload.created_by ?? null,
    steps: Array.isArray(payload.steps)
      ? payload.steps.map(step => ({
          id: step.id || generateId(),
          title: step.title ?? '',
          description: step.description ?? '',
        }))
      : [],
    contacts: Array.isArray(payload.contacts)
      ? payload.contacts.map(contact => ({
          id: contact.id || generateId(),
          name: contact.name ?? '',
          role: contact.role ?? '',
          phone: contact.phone ?? '',
          email: contact.email ?? '',
        }))
      : [],
  };
}

