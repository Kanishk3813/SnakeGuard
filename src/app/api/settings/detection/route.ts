import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { defaultSystemSettings } from '@/lib/defaultSystemSettings';

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('confidence_threshold, detection_cooldown, max_detections_per_hour')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const merged = {
      confidenceThreshold: data?.confidence_threshold ?? defaultSystemSettings.confidence_threshold,
      detectionCooldown: data?.detection_cooldown ?? defaultSystemSettings.detection_cooldown,
      maxDetectionsPerHour: data?.max_detections_per_hour ?? defaultSystemSettings.max_detections_per_hour,
    };

    return NextResponse.json(merged);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to load detection settings',
        confidenceThreshold: defaultSystemSettings.confidence_threshold,
        detectionCooldown: defaultSystemSettings.detection_cooldown,
        maxDetectionsPerHour: defaultSystemSettings.max_detections_per_hour,
      },
      { status: 200 }
    );
  }
}

