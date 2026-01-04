import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

/**
 * POST /api/pipeline/process-queue
 * Process pending pipeline triggers from the queue
 * This should be called periodically (via cron job or scheduled task)
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    // Get unprocessed triggers (limit to 10 at a time)
    const { data: pendingTriggers, error: fetchError } = await supabaseAdmin
      .from('pipeline_trigger_queue')
      .select('*')
      .eq('processed', false)
      .order('triggered_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('[Pipeline Queue] Error fetching triggers:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch queue', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!pendingTriggers || pendingTriggers.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending triggers'
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each trigger
    for (const trigger of pendingTriggers) {
      try {
        // Call the pipeline API
        const requestUrl = new URL(request.url);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`;
        
        const pipelineResponse = await fetch(`${baseUrl}/api/detections/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ detectionId: trigger.detection_id }),
        });

        const pipelineData = await pipelineResponse.json();

        if (pipelineResponse.ok && pipelineData.success) {
          // Mark as processed
          await supabaseAdmin
            .from('pipeline_trigger_queue')
            .update({
              processed: true,
              processed_at: new Date().toISOString()
            })
            .eq('id', trigger.id);

          results.processed++;
          console.log(`[Pipeline Queue] Processed trigger for detection ${trigger.detection_id}`);
        } else {
          // Mark as failed
          const errorMsg = pipelineData.error || pipelineData.message || 'Unknown error';
          await supabaseAdmin
            .from('pipeline_trigger_queue')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: errorMsg,
              retry_count: trigger.retry_count + 1
            })
            .eq('id', trigger.id);

          results.failed++;
          results.errors.push(`Detection ${trigger.detection_id}: ${errorMsg}`);
          console.error(`[Pipeline Queue] Failed to process trigger for detection ${trigger.detection_id}:`, errorMsg);
        }
      } catch (error: any) {
        // Mark as failed
        await supabaseAdmin
          .from('pipeline_trigger_queue')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            error_message: error.message,
            retry_count: trigger.retry_count + 1
          })
          .eq('id', trigger.id);

        results.failed++;
        results.errors.push(`Detection ${trigger.detection_id}: ${error.message}`);
        console.error(`[Pipeline Queue] Error processing trigger:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error: any) {
    console.error('[Pipeline Queue] Fatal error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pipeline/process-queue
 * Get queue statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const { data: stats, error } = await supabaseAdmin
      .from('pipeline_trigger_queue')
      .select('processed')
      .then(result => {
        if (result.error) throw result.error;
        const total = result.data?.length || 0;
        const processed = result.data?.filter(t => t.processed).length || 0;
        return {
          data: {
            total,
            processed,
            pending: total - processed
          },
          error: null
        };
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      ...stats
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}




