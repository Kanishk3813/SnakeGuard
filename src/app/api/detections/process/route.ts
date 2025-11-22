import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';
import { IncidentPlaybook, IncidentAssignmentStepState, IncidentPlaybookStep } from '@/types';

/**
 * Automated Detection Processing Pipeline
 * 
 * This endpoint orchestrates the complete incident response workflow:
 * 1. Classify the snake (if not already classified)
 * 2. Assign appropriate playbook based on risk level
 * 3. Send notifications to relevant users
 * 4. Create incident assignment
 * 5. Track response metrics
 * 
 * Can be triggered by:
 * - Database trigger (webhook)
 * - Manual API call
 * - Scheduled job
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let detectionId: string | null = null;

  try {
    const body = await request.json();
    detectionId = body.detectionId;

    if (!detectionId) {
      return NextResponse.json(
        { error: 'detectionId is required' },
        { status: 400 }
      );
    }

    console.log(`[Pipeline] Starting processing for detection: ${detectionId}`);

    const supabaseAdmin = getSupabaseAdminClient();

    // Step 1: Fetch detection
    const { data: detection, error: fetchError } = await supabaseAdmin
      .from('snake_detections')
      .select('*')
      .eq('id', detectionId)
      .single();

    if (fetchError || !detection) {
      console.error('[Pipeline] Detection not found:', {
        detectionId,
        error: fetchError,
        hasData: !!detection
      });
      return NextResponse.json(
        { 
          error: 'Detection not found', 
          message: fetchError?.message || 'Detection not found in database',
          details: fetchError 
        },
        { status: 404 }
      );
    }

    console.log(`[Pipeline] Detection fetched:`, {
      id: detection.id,
      confidence: detection.confidence,
      processed: detection.processed,
      hasImage: !!detection.image_url
    });

    // Check if already processed
    if (detection.processed === true && detection.venomous !== null) {
      console.log(`[Pipeline] Detection ${detectionId} already processed, skipping`);
      return NextResponse.json({
        success: true,
        message: 'Detection already processed',
        detectionId: detection.id,
        alreadyProcessed: true
      });
    }

    // Check confidence threshold
    const { data: systemSettings } = await supabaseAdmin
      .from('system_settings')
      .select('confidence_threshold, alert_enabled')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const confidenceThreshold = systemSettings?.confidence_threshold ?? 0.5;
    const alertEnabled = systemSettings?.alert_enabled ?? true;

    if (detection.confidence < confidenceThreshold) {
      console.log(`[Pipeline] Detection ${detectionId} below threshold (${detection.confidence} < ${confidenceThreshold})`);
      await supabaseAdmin
        .from('snake_detections')
        .update({ 
          processed: true,
          notes: `Auto-skipped: confidence ${(detection.confidence * 100).toFixed(1)}% below threshold ${(confidenceThreshold * 100).toFixed(0)}%`
        })
        .eq('id', detectionId);
      
      return NextResponse.json({
        success: true,
        message: 'Detection below confidence threshold',
        detectionId,
        skipped: true
      });
    }

    const pipelineResults = {
      detectionId,
      classificationCompleted: false,
      playbookAssigned: false,
      notificationsSent: false,
      incidentCreated: false,
      errors: [] as string[],
      responseTime: 0
    };

    // Construct base URL from request for server-side API calls
    // Prioritize request URL over env var (for localhost development)
    const requestUrl = new URL(request.url);
    const isLocalhost = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
    const baseUrl = isLocalhost 
      ? `${requestUrl.protocol}//${requestUrl.host}`  // Use localhost when testing locally
      : (process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`);
    
    console.log(`[Pipeline] Using base URL: ${baseUrl} (localhost: ${isLocalhost})`);

    // Step 2: Auto-classify (if not already classified)
    if (detection.venomous === null || detection.venomous === undefined || !detection.species) {
      try {
        console.log(`[Pipeline] Starting classification for ${detectionId}`);
        
        const classifyResponse = await fetch(
          `${baseUrl}/api/classify-async`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ detectionId }),
          }
        );

        if (!classifyResponse.ok) {
          const errorText = await classifyResponse.text().catch(() => '');
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `HTTP ${classifyResponse.status}` };
          }
          const errorMsg = errorData.message || errorData.error || `HTTP ${classifyResponse.status}: ${classifyResponse.statusText}`;
          console.error(`[Pipeline] Classification API failed:`, {
            status: classifyResponse.status,
            statusText: classifyResponse.statusText,
            error: errorData
          });
          throw new Error(errorMsg);
        }

        const classifyResult = await classifyResponse.json();
        console.log(`[Pipeline] Classification response:`, {
          success: classifyResult.success,
          alreadyClassified: classifyResult.alreadyClassified,
          hasClassification: !!classifyResult.classification
        });
        
        if (classifyResult.success) {
          pipelineResults.classificationCompleted = true;
          console.log(`[Pipeline] Classification completed for ${detectionId}`, classifyResult.classification);

          // Wait a moment for database to update
          await new Promise(resolve => setTimeout(resolve, 500));

          // Refresh detection data to get updated classification
          const { data: updatedDetection, error: refreshError } = await supabaseAdmin
            .from('snake_detections')
            .select('*')
            .eq('id', detectionId)
            .single();

          if (refreshError) {
            console.warn(`[Pipeline] Failed to refresh detection after classification:`, refreshError);
          } else if (updatedDetection) {
            console.log(`[Pipeline] Detection refreshed:`, {
              species: updatedDetection.species,
              venomous: updatedDetection.venomous,
              risk_level: updatedDetection.risk_level
            });
            Object.assign(detection, updatedDetection);
          } else {
            console.warn(`[Pipeline] Detection not found after refresh`);
          }
        } else {
          console.warn(`[Pipeline] Classification returned success=false:`, classifyResult);
          pipelineResults.errors.push(`Classification: ${classifyResult.message || 'Unknown error'}`);
        }
      } catch (error: any) {
        console.error(`[Pipeline] Classification error:`, {
          message: error.message,
          stack: error.stack,
          detectionId
        });
        pipelineResults.errors.push(`Classification: ${error.message}`);
        // Continue pipeline even if classification fails
      }
    } else {
      pipelineResults.classificationCompleted = true;
      console.log(`[Pipeline] Detection ${detectionId} already classified`);
    }

    // Step 3: Auto-assign playbook (if risk level is available)
    if (detection.risk_level && alertEnabled) {
      try {
        console.log(`[Pipeline] Assigning playbook for ${detectionId} (risk: ${detection.risk_level})`);
        
        // Find matching playbook directly (no auth needed for server-side)
        const playbook = await findMatchingPlaybook(supabaseAdmin, detection.risk_level, detection.species);
        
        if (playbook) {
          const stepsState: IncidentAssignmentStepState[] = playbook.steps.map((step: IncidentPlaybookStep) => ({
            id: step.id,
            title: step.title,
            completed: false,
          }));

          const { data: assignment, error: assignError } = await supabaseAdmin
            .from('incident_assignments')
            .upsert(
              {
                detection_id: detection.id,
                playbook_id: playbook.id,
                steps_state: stepsState,
                status: 'active',
              },
              { onConflict: 'detection_id' }
            )
            .select('*, playbook:incident_playbooks(*)')
            .single();

          if (assignError) {
            throw assignError;
          }

          pipelineResults.playbookAssigned = true;
          pipelineResults.incidentCreated = true;
          console.log(`[Pipeline] Playbook assigned for ${detectionId}:`, playbook.title);
        } else {
          // Not an error - playbooks are optional
          console.log(`[Pipeline] No playbook found for risk level "${detection.risk_level}"${detection.species ? ` / species "${detection.species}"` : ''} - this is normal if no playbook is configured`);
        }
      } catch (error: any) {
        console.error(`[Pipeline] Playbook assignment error:`, error);
        pipelineResults.errors.push(`Playbook assignment: ${error.message}`);
      }
    }

    // Step 4: Auto-send notifications (if alerts enabled)
    if (alertEnabled && detection.latitude && detection.longitude) {
      try {
        console.log(`[Pipeline] Sending notifications for ${detectionId}`);
        
        // Use same baseUrl from classification step
        const notifyResponse = await fetch(
          `${baseUrl}/api/notifications/send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ detectionId }),
          }
        );

        if (notifyResponse.ok) {
          const notifyResult = await notifyResponse.json();
          pipelineResults.notificationsSent = true;
          console.log(`[Pipeline] Notifications sent:`, {
            emails: notifyResult.emailsSent || 0,
            sms: notifyResult.smsSent || 0,
            globalEmails: notifyResult.globalEmailsSent || 0,
            globalSms: notifyResult.globalSmsSent || 0
          });
        } else {
          const errorData = await notifyResponse.json().catch(() => ({}));
          console.warn(`[Pipeline] Notification sending failed:`, errorData);
          pipelineResults.errors.push(`Notifications: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error: any) {
        console.error(`[Pipeline] Notification error:`, error);
        pipelineResults.errors.push(`Notifications: ${error.message}`);
      }
    }

    // Step 5: Mark detection as processed
    await supabaseAdmin
      .from('snake_detections')
      .update({
        processed: true,
        updated_at: new Date().toISOString(),
        notes: detection.notes 
          ? `${detection.notes}\n[Auto-processed ${new Date().toISOString()}]`
          : `[Auto-processed ${new Date().toISOString()}]`
      })
      .eq('id', detectionId);

    // Step 6: Track response metrics
    pipelineResults.responseTime = Date.now() - startTime;
    
    try {
      const { error: metricsError } = await supabaseAdmin
        .from('pipeline_metrics')
        .insert({
          detection_id: detectionId,
          response_time_ms: pipelineResults.responseTime,
          classification_completed: pipelineResults.classificationCompleted,
          playbook_assigned: pipelineResults.playbookAssigned,
          notifications_sent: pipelineResults.notificationsSent,
          errors: pipelineResults.errors.length > 0 ? pipelineResults.errors : null,
          created_at: new Date().toISOString()
        });
      
      if (metricsError) {
        // Table might not exist yet, log but don't fail
        console.warn('[Pipeline] Metrics table not available:', metricsError.message);
      }
    } catch (metricsError: any) {
      // Non-critical, continue
      console.warn('[Pipeline] Failed to log metrics:', metricsError?.message || metricsError);
    }

    // Pipeline is successful if classification completed OR notifications sent
    // Playbook assignment is optional, so don't require it for success
    const success = pipelineResults.classificationCompleted || 
                   pipelineResults.notificationsSent;

    console.log(`[Pipeline] Processing complete for ${detectionId} in ${pipelineResults.responseTime}ms`);

    return NextResponse.json({
      success,
      ...pipelineResults,
      message: success 
        ? 'Detection processed successfully' 
        : 'Processing completed with errors'
    });

  } catch (error: any) {
    console.error(`[Pipeline] Fatal error processing detection ${detectionId}:`, error);
    
    // Try to mark detection with error
    if (detectionId) {
      try {
        await getSupabaseAdminClient()
          .from('snake_detections')
          .update({
            notes: `[Pipeline Error ${new Date().toISOString()}]: ${error.message}`
          })
          .eq('id', detectionId);
      } catch (updateError) {
        console.error('[Pipeline] Failed to update detection with error:', updateError);
      }
    }

    return NextResponse.json(
      {
        error: 'Pipeline processing failed',
        message: error.message,
        detectionId,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Helper function to find matching playbook (reused from incidents/assign)
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

