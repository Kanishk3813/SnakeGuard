import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { IncidentPlaybook } from '@/types';
import { generateId } from '@/lib/id';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const payload = (await request.json()) as IncidentPlaybook;
    const supabaseAdmin = getSupabaseAdminClient();
    const record = normalizePlaybookPayload({ ...payload, id });

    const { data, error } = await supabaseAdmin
      .from('incident_playbooks')
      .update(record)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    const message = error?.message || 'Unable to update playbook';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser(request);
    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from('incident_playbooks')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message = error?.message || 'Unable to delete playbook';
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

