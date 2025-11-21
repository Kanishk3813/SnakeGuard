import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { requireAdminUser } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const detectionId = request.nextUrl.searchParams.get('detectionId');
    if (!detectionId) {
      return NextResponse.json({ error: 'detectionId query parameter is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('incident_assignments')
      .select('*, playbook:incident_playbooks(*)')
      .eq('detection_id', detectionId)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Fetch assignment error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch assignment' },
      { status: 500 }
    );
  }
}

