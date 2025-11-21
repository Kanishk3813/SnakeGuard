import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { requireAdminUser } from '@/lib/admin-auth';
import { defaultSystemSettings } from '@/lib/defaultSystemSettings';
import { SystemSettings } from '@/types';

const SETTINGS_COLUMNS = `
  id,
  confidence_threshold,
  detection_cooldown,
  max_detections_per_hour,
  alert_enabled,
  alert_email_recipients,
  alert_sms_recipients,
  alert_webhook_url,
  model_version,
  model_update_auto,
  image_retention_days,
  auto_cleanup,
  api_rate_limit,
  api_key_expiry_days,
  weather_api_enabled,
  weather_api_key,
  twilio_enabled,
  twilio_account_sid,
  twilio_auth_token,
  twilio_phone_number,
  created_at,
  updated_at
`;

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select(SETTINGS_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: data ?? defaultSystemSettings,
    });
  } catch (error: any) {
    const message = error?.message || 'Unable to load settings';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const payload = sanitizePayload(body);
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: existing } = await supabaseAdmin
      .from('system_settings')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const upsertPayload = {
      ...(existing ?? {}),
      ...defaultSystemSettings,
      ...payload,
      id: existing?.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('system_settings').upsert(upsertPayload, {
      onConflict: 'id',
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message = error?.message || 'Unable to save settings';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function sanitizePayload(input: Partial<SystemSettings>): Partial<SystemSettings> {
  const clean: Partial<SystemSettings> = {};
  const allowedKeys: (keyof SystemSettings)[] = [
    'confidence_threshold',
    'detection_cooldown',
    'max_detections_per_hour',
    'alert_enabled',
    'alert_email_recipients',
    'alert_sms_recipients',
    'alert_webhook_url',
    'model_version',
    'model_update_auto',
    'image_retention_days',
    'auto_cleanup',
    'api_rate_limit',
    'api_key_expiry_days',
    'weather_api_enabled',
    'weather_api_key',
    'twilio_enabled',
    'twilio_account_sid',
    'twilio_auth_token',
    'twilio_phone_number',
  ];

  for (const key of allowedKeys) {
    if (key in input) {
      // @ts-expect-error dynamic assignment
      clean[key] = input[key];
    }
  }

  return clean;
}

