import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

/**
 * Polling Service for Unprocessed Detections
 * 
 * This endpoint can be called periodically (via cron job, Vercel Cron, etc.)
 * to process detections that weren't automatically processed by the database trigger.
 * 
 * Useful when:
 * - Database triggers are not available
 * - Trigger failed for some reason
 * - Processing needs to be retried
 * 
 * Usage:
 * - Set up Vercel Cron: vercel.json
 * - Or use external cron service (cron-job.org, etc.)
 * - Or call manually from admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '10');
    const maxAge = parseInt(searchParams.get('maxAge') || '3600'); // Default 1 hour
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.5');

    // Find unprocessed detections
    const cutoffTime = new Date(Date.now() - maxAge * 1000).toISOString();
    
    const { data: unprocessedDetections, error: fetchError } = await supabaseAdmin
      .from('snake_detections')
      .select('id, confidence, processed, timestamp')
      .eq('processed', false)
      .gte('confidence', minConfidence)
      .gte('timestamp', cutoffTime)
      .order('timestamp', { ascending: true })
      .limit(limit);

    if (fetchError) {
      throw fetchError;
    }

    if (!unprocessedDetections || unprocessedDetections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unprocessed detections found',
        processed: 0,
        detections: []
      });
    }

    console.log(`[Poll] Found ${unprocessedDetections.length} unprocessed detections`);

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
      detections: [] as Array<{ id: string; status: string; error?: string }>
    };

    // Use relative URL for same-origin requests (more reliable)
    // Construct base URL from request for server-side API calls
    // Prioritize request URL over env var (for localhost development)
    const requestUrl = new URL(request.url);
    const isLocalhost = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
    const baseUrl = isLocalhost 
      ? `${requestUrl.protocol}//${requestUrl.host}`  // Use localhost when testing locally
      : (process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`);
    
    console.log(`[Poll] Using base URL: ${baseUrl} (localhost: ${isLocalhost})`);

    // Process each detection
    for (const detection of unprocessedDetections) {
      try {
        // Use baseUrl for server-side fetch
        const processUrl = `${baseUrl}/api/detections/process`;
        console.log(`[Poll] Calling process endpoint: ${processUrl}`);
        
        const response = await fetch(processUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ detectionId: detection.id }),
        });

        if (response.ok) {
          const resultData = await response.json().catch(() => ({}));
          results.processed++;
          results.detections.push({ id: detection.id, status: 'success' });
          console.log(`[Poll] Successfully processed detection ${detection.id}`, resultData);
        } else {
          const errorText = await response.text().catch(() => '');
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
          }
          
          results.failed++;
          const errorMsg = errorData.message || errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
          results.errors.push(`${detection.id}: ${errorMsg}`);
          results.detections.push({ 
            id: detection.id, 
            status: 'failed', 
            error: errorMsg 
          });
          console.error(`[Poll] Failed to process ${detection.id}:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
        }

        // Small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        results.failed++;
        const errorMsg = error.message || 'Network error';
        results.errors.push(`${detection.id}: ${errorMsg}`);
        results.detections.push({ 
          id: detection.id, 
          status: 'error', 
          error: errorMsg 
        });
        console.error(`[Poll] Error processing ${detection.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} of ${unprocessedDetections.length} detections`,
      ...results
    });

  } catch (error: any) {
    console.error('[Poll] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Polling service failed',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

