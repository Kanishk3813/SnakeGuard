import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { defaultSystemSettings } from '@/lib/defaultSystemSettings';
import { IncidentPlaybook } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
  });
}

// Create admin client for server-side operations
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Server configuration error',
        details: 'SUPABASE_SERVICE_ROLE_KEY is missing. Please add it to your .env.local file.',
        hint: 'Get it from Supabase Dashboard → Settings → API → service_role key'
      }, { status: 500 });
    }

    const { detectionId } = await request.json();

    if (!detectionId) {
      return NextResponse.json({ error: 'Detection ID is required' }, { status: 400 });
    }

    // Get detection details
    const { data: detection, error: detectionError } = await supabaseAdmin
      .from('snake_detections')
      .select('*')
      .eq('id', detectionId)
      .single();

    if (detectionError || !detection) {
      return NextResponse.json({ error: 'Detection not found' }, { status: 404 });
    }

    // Check if detection has valid coordinates
    if (!detection.latitude || !detection.longitude) {
      return NextResponse.json({ message: 'Detection has no location data' }, { status: 200 });
    }

    // Get system settings
    const { data: systemSettings } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const effectiveSettings = {
      ...defaultSystemSettings,
      ...(systemSettings || {}),
    };

    if (!effectiveSettings.alert_enabled) {
      return NextResponse.json({ message: 'Alerts disabled via admin settings' }, { status: 200 });
    }

    const detectionConfidence = detection.confidence ?? 0;
    if (detectionConfidence < effectiveSettings.confidence_threshold) {
      return NextResponse.json(
        {
          message: `Detection skipped because confidence ${(
            detectionConfidence * 100
          ).toFixed(1)}% is below ${(
            effectiveSettings.confidence_threshold * 100
          ).toFixed(0)}% threshold`,
        },
        { status: 200 }
      );
    }

    const playbookMatch =
      detection.risk_level
        ? await findPlaybookForDetection(
            supabaseAdmin,
            detection.risk_level,
            detection.species
          )
        : null;

    if (playbookMatch) {
      await ensureAssignmentExists(supabaseAdmin, detection.id, playbookMatch);
    }

    // Use a large radius to find all users, then filter by user's alert_radius
    const searchRadius = 10000;

    // Find users within radius
    let users: any[] = [];
    let usersError: any = null;

    try {
      const result = await supabaseAdmin.rpc(
        'get_users_within_radius',
        {
          detection_lat: detection.latitude,
          detection_lon: detection.longitude,
          radius_km: searchRadius,
        }
      );
      users = result.data || [];
      usersError = result.error;
    } catch (err: any) {
      usersError = err;
    }

    // Fallback query if function doesn't exist
    if (usersError) {
      console.error('Database function error:', usersError);
      console.log('Falling back to direct query...');

      const { data: allProfiles, error: profilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('user_id, full_name, phone_number, latitude, longitude')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (profilesError) {
        return NextResponse.json({ 
          error: 'Failed to query users',
          details: profilesError.message,
          hint: 'Run fix_notification_function.sql in Supabase SQL Editor'
        }, { status: 500 });
      }

      const userIds = allProfiles?.map(p => p.user_id) || [];
      const { data: allSettings } = await supabaseAdmin
        .from('user_settings')
        .select('user_id, email_notifications, sms_notifications, push_notifications, alert_radius, alert_high_risk_only')
        .in('user_id', userIds);

      const settingsMap = new Map();
      (allSettings || []).forEach(s => {
        settingsMap.set(s.user_id, s);
      });

      let authUsersMap = new Map();
      try {
        const authResult = await supabaseAdmin.auth.admin.listUsers();
        if (authResult.data && !authResult.error) {
          const authUsersList = authResult.data.users || [];
          authUsersList.forEach((u: any) => {
            authUsersMap.set(u.id, u.email);
          });
        }
      } catch (authError: any) {
        console.error('Error fetching auth users:', authError.message);
      }

      users = (allProfiles || []).map(profile => {
        const settings = settingsMap.get(profile.user_id) || {};
        const email = authUsersMap.get(profile.user_id) || '';
        
        const R = 6371;
        const dLat = (detection.latitude - profile.latitude) * Math.PI / 180;
        const dLon = (detection.longitude - profile.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(profile.latitude * Math.PI / 180) * Math.cos(detection.latitude * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance_km = R * c;

        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: email,
          phone_number: profile.phone_number,
          distance_km,
          email_notifications: settings.email_notifications ?? true,
          sms_notifications: settings.sms_notifications ?? false,
          push_notifications: settings.push_notifications ?? true,
          alert_radius: settings.alert_radius ?? 10,
          alert_high_risk_only: settings.alert_high_risk_only ?? true,
        };
      }).filter(user => user.distance_km <= searchRadius);
    }

    const results = {
      emailsSent: 0,
      smsSent: 0,
      globalEmailsSent: 0,
      globalSmsSent: 0,
      webhookTriggered: false,
      errors: [] as string[],
      playbookUsed: playbookMatch?.id ?? null,
    };

    const twilioConfig = {
      enabled: effectiveSettings.twilio_enabled,
      accountSid: effectiveSettings.twilio_account_sid,
      authToken: effectiveSettings.twilio_auth_token,
      fromNumber: effectiveSettings.twilio_phone_number,
    };

    const usersToNotify = users || [];

    // Process each user
    for (const user of usersToNotify) {
      // Check if notification already sent
      const { data: existingNotification } = await supabaseAdmin
        .from('notification_log')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('detection_id', detectionId)
        .eq('status', 'sent')
        .single();

      if (existingNotification) {
        continue;
      }

      // Check user's alert radius
      if (user.distance_km > user.alert_radius) {
        continue;
      }

      // Check high risk only setting
      if (user.alert_high_risk_only && detection.confidence < 0.7) {
        continue;
      }

      // Send email notification
      if (user.email_notifications && user.email) {
        try {
          const emailResult = await sendEmailNotification(
            user.email,
            detection,
            user.distance_km,
            playbookMatch
          );
          if (emailResult.success) {
            results.emailsSent++;
            await logNotification(user.user_id, detectionId, 'email', 'sent');
          } else {
            results.errors.push(`Email failed for ${user.email}: ${emailResult.error}`);
            await logNotification(user.user_id, detectionId, 'email', 'failed', emailResult.error);
          }
        } catch (error: any) {
          results.errors.push(`Email error for ${user.email}: ${error.message}`);
          await logNotification(user.user_id, detectionId, 'email', 'failed', error.message);
        }
      }

      // Send SMS notification
      if (user.sms_notifications && user.phone_number) {
        try {
          const smsResult = await sendSMSNotification(
            user.phone_number,
            detection,
            user.distance_km,
            twilioConfig,
            playbookMatch
          );
          if (smsResult.success) {
            results.smsSent++;
            await logNotification(user.user_id, detectionId, 'sms', 'sent');
          } else {
            results.errors.push(`SMS failed for ${user.phone_number}: ${smsResult.error}`);
            await logNotification(user.user_id, detectionId, 'sms', 'failed', smsResult.error);
          }
        } catch (error: any) {
          results.errors.push(`SMS error for ${user.phone_number}: ${error.message}`);
          await logNotification(user.user_id, detectionId, 'sms', 'failed', error.message);
        }
      }
    }

    // Notify global recipients configured in admin settings
    const globalResults = await notifyGlobalContacts({
      detection,
      settings: effectiveSettings,
      twilioConfig,
      playbook: playbookMatch,
    });

    results.globalEmailsSent = globalResults.emailsSent;
    results.globalSmsSent = globalResults.smsSent;
    if (globalResults.error) {
      results.errors.push(globalResults.error);
    }

    if (effectiveSettings.alert_webhook_url) {
      try {
        await fetch(effectiveSettings.alert_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            detection,
            triggeredAt: new Date().toISOString(),
          }),
        });
        results.webhookTriggered = true;
      } catch (error: any) {
        results.errors.push(`Webhook error: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      usersFound: usersToNotify.length,
      ...results,
    });
  } catch (error: any) {
    console.error('Notification error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function sendEmailNotification(
  email: string,
  detection: any,
  distance?: number,
  playbook?: IncidentPlaybook | null
) {
  try {
    // Get SMTP settings from Supabase (stored in system_settings or use env vars)
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '465');
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM_EMAIL || 'noreply@snakeguard.app';

    if (!smtpHost || !smtpUser || !smtpPassword) {
      return { 
        success: false, 
        error: 'SMTP not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in .env.local' 
      };
    }

    // Create transporter using Supabase SMTP settings
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    // Email content
    const emailHTML = generateEmailHTML(detection, distance, playbook);
    const distanceLabel =
      typeof distance === 'number'
        ? `${distance.toFixed(1)} km`
        : 'near one of your monitored locations';
    const emailText = `
🐍 Snake Detection Alert

A snake has been detected ${distanceLabel} from your location.

Detection Details:
- Confidence: ${(detection.confidence * 100).toFixed(1)}%
- Detected At: ${new Date(detection.timestamp).toLocaleString()}
${detection.species ? `- Species: ${detection.species}` : ''}
- Location: ${detection.latitude?.toFixed(6)}, ${detection.longitude?.toFixed(6)}
${
  playbook?.steps?.length
    ? `- Next Steps:\n${playbook.steps
        .slice(0, 3)
        .map((step, idx) => `   ${idx + 1}. ${step.title}`)
        .join('\n')}`
    : ''
}

View Detection: ${process.env.NEXT_PUBLIC_APP_URL || 'https://snakeguard.vercel.app'}/detections

Manage preferences: ${process.env.NEXT_PUBLIC_APP_URL || 'https://snakeguard.vercel.app'}/settings
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `SnakeGuard <${smtpFrom}>`,
      to: email,
      subject:
        typeof distance === 'number'
          ? `🐍 Snake Detected ${distance.toFixed(1)}km Away`
          : '🐍 Snake Detection Alert',
      text: emailText,
      html: emailHTML,
    });

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
}

async function sendSMSNotification(
  phoneNumber: string,
  detection: any,
  distance: number | undefined,
  twilioConfig: {
    enabled: boolean;
    accountSid?: string | null;
    authToken?: string | null;
    fromNumber?: string | null;
  },
  playbook?: IncidentPlaybook | null
) {
  if (!twilioConfig.enabled || !twilioConfig.accountSid) {
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const accountSid = twilioConfig.accountSid!;
    const authToken = twilioConfig.authToken;
    const fromNumber = twilioConfig.fromNumber;

    if (!authToken || !fromNumber) {
      return { success: false, error: 'Twilio credentials incomplete' };
    }

    const distanceLabel =
      typeof distance === 'number'
        ? `${distance.toFixed(1)}km away`
        : 'near your monitored location';

    const topStep = playbook?.steps?.[0]?.title;
    const message = `🐍 Snake Alert: Detected ${distanceLabel}. Confidence: ${(detection.confidence * 100).toFixed(
      0
    )}%.${topStep ? ` Next: ${topStep}.` : ''} View: ${
      process.env.NEXT_PUBLIC_APP_URL || 'https://snakeguard.vercel.app'
    }/detections`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber!,
          To: phoneNumber,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function logNotification(
  userId: string,
  detectionId: string,
  type: 'email' | 'sms' | 'push',
  status: 'pending' | 'sent' | 'failed',
  errorMessage?: string
) {
  try {
    await supabaseAdmin?.from('notification_log').insert({
      user_id: userId,
      detection_id: detectionId,
      notification_type: type,
      status,
      error_message: errorMessage,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

async function notifyGlobalContacts({
  detection,
  settings,
  twilioConfig,
  playbook,
}: {
  detection: any;
  settings: any;
  twilioConfig: {
    enabled: boolean;
    accountSid?: string | null;
    authToken?: string | null;
    fromNumber?: string | null;
  };
  playbook?: IncidentPlaybook | null;
}) {
  let emailsSent = 0;
  let smsSent = 0;
  try {
    const globalEmails = Array.isArray(settings.alert_email_recipients)
      ? Array.from(
          new Set(
            (settings.alert_email_recipients as unknown[]).filter(isNonEmptyString)
          )
        )
      : [];
    const globalSms = Array.isArray(settings.alert_sms_recipients)
      ? Array.from(
          new Set(
            (settings.alert_sms_recipients as unknown[]).filter(isNonEmptyString)
          )
        )
      : [];

    for (const email of globalEmails) {
        const result = await sendEmailNotification(email, detection, undefined, playbook);
      if (result.success) {
        emailsSent += 1;
      }
    }

    for (const phone of globalSms) {
      const smsResult = await sendSMSNotification(
        phone,
        detection,
        undefined,
        twilioConfig,
        playbook
      );
      if (smsResult.success) {
        smsSent += 1;
      }
    }

    return { emailsSent, smsSent };
  } catch (error: any) {
    return { emailsSent, smsSent, error: error?.message || 'Failed to notify global contacts' };
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function generateEmailHTML(detection: any, distance?: number, playbook?: IncidentPlaybook | null) {
  const distanceCopy =
    typeof distance === 'number'
      ? `A snake has been detected ${distance.toFixed(1)} km from your location.`
      : 'A snake has been detected near one of your monitored locations.';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🐍 Snake Detection Alert</h1>
          </div>
          <div class="content">
            <div class="alert-box">
              <strong>Alert:</strong> ${distanceCopy}
            </div>
            <h2>Detection Details</h2>
            <p><strong>Confidence:</strong> ${(detection.confidence * 100).toFixed(1)}%</p>
            <p><strong>Detected At:</strong> ${new Date(detection.timestamp).toLocaleString()}</p>
            ${detection.species ? `<p><strong>Species:</strong> ${detection.species}</p>` : ''}
            <p><strong>Location:</strong> ${detection.latitude?.toFixed(6)}, ${detection.longitude?.toFixed(6)}</p>
            ${
              playbook?.steps?.length
                ? `<div style="margin-top:16px;">
                    <strong>Immediate Steps:</strong>
                    <ol style="padding-left:18px;margin-top:8px;">
                      ${playbook.steps
                        .slice(0, 3)
                        .map(step => `<li style="margin-bottom:4px;">${step.title}</li>`)
                        .join('')}
                    </ol>
                  </div>`
                : ''
            }
            ${
              playbook?.first_aid
                ? `<div style="margin-top:16px;padding:12px;border-radius:8px;background:#fee2e2;color:#b91c1c;">
                    <strong>First Aid Guidance:</strong>
                    <p style="margin-top:8px;">${playbook.first_aid}</p>
                  </div>`
                : ''
            }
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://snakeguard.vercel.app'}/detections" class="button">
              View Detection
            </a>
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
              You're receiving this because you have alerts enabled in your SnakeGuard settings.
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://snakeguard.vercel.app'}/settings">Manage preferences</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function findPlaybookForDetection(
  supabaseAdmin: SupabaseClient,
  riskLevel?: string | null,
  species?: string | null
): Promise<IncidentPlaybook | null> {
  if (!riskLevel) return null;

  if (species) {
    const { data } = await supabaseAdmin
      .from('incident_playbooks')
      .select('*')
      .eq('risk_level', riskLevel)
      .eq('species', species)
      .maybeSingle();
    if (data) return data;
  }

  const { data } = await supabaseAdmin
    .from('incident_playbooks')
    .select('*')
    .eq('risk_level', riskLevel)
    .is('species', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

async function ensureAssignmentExists(
  supabaseAdmin: SupabaseClient,
  detectionId: string,
  playbook: IncidentPlaybook
) {
  const { data: existing } = await supabaseAdmin
    .from('incident_assignments')
    .select('*')
    .eq('detection_id', detectionId)
    .maybeSingle();

  if (existing) return existing;

  const stepsState = (playbook.steps || []).map(step => ({
    id: step.id,
    title: step.title,
    completed: false,
  }));

  const { data } = await supabaseAdmin
    .from('incident_assignments')
    .insert({
      detection_id: detectionId,
      playbook_id: playbook.id,
      steps_state: stepsState,
    })
    .select()
    .single();

  return data;
}
