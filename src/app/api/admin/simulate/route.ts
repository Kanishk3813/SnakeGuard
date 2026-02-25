import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { requireAdminUser } from '@/lib/admin-auth';
import { generateId } from '@/lib/id';

/**
 * POST /api/admin/simulate
 *
 * Creates a simulated snake detection and triggers the full processing pipeline.
 * Admin-only endpoint — requires a valid admin bearer token.
 *
 * Body:
 *  - species (string)           – e.g. "Indian Cobra (Naja naja)"
 *  - confidence (number 0-1)    – detection confidence
 *  - latitude / longitude       – GPS coordinates
 *  - risk_level (string)        – low | medium | high | critical
 *  - venomous (boolean)         – whether the species is venomous
 *  - notes (string, optional)   – free-text notes
 *  - triggerPipeline (boolean)  – if true (default), triggers the full pipeline
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const adminUser = await requireAdminUser(request);

    // 2. Parse body
    const body = await request.json();
    const {
      species,
      confidence = 0.95,
      latitude,
      longitude,
      risk_level = 'high',
      venomous = true,
      notes = '',
      triggerPipeline = true,
    } = body;

    // 3. Validate required fields
    if (!species || species.trim().length === 0) {
      return NextResponse.json({ error: 'species is required' }, { status: 400 });
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'latitude and longitude are required (numbers)' }, { status: 400 });
    }
    if (!['low', 'medium', 'high', 'critical'].includes(risk_level)) {
      return NextResponse.json({ error: 'risk_level must be low, medium, high, or critical' }, { status: 400 });
    }
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      return NextResponse.json({ error: 'confidence must be a number between 0 and 1' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const detectionId = generateId();
    const now = new Date().toISOString();

    // 4. Build the simulated detection record — pre-populated with classification
    const simulatedDetection = {
      id: detectionId,
      timestamp: now,
      confidence,
      image_url: '', // simulated — no real image
      latitude,
      longitude,
      processed: false, // pipeline will mark it processed
      species,
      venomous,
      risk_level,
      classification_confidence: confidence,
      classification_description: `Simulated detection of ${species}`,
      classification_first_aid: venomous
        ? 'Keep calm. Immobilise the bitten limb. Seek immediate medical attention. Do NOT try to suck venom.'
        : 'Clean the wound and apply antiseptic. Seek medical evaluation if swelling persists.',
      classified_at: now,
      notes: `[SIMULATED] ${notes || 'Created via admin simulation dashboard'}`.trim(),
      status: 'pending' as const,
    };

    // 5. Insert into database
    const { data: insertedDetection, error: insertError } = await supabaseAdmin
      .from('snake_detections')
      .insert(simulatedDetection)
      .select()
      .single();

    if (insertError) {
      console.error('[Simulate] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert simulated detection', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`[Simulate] Detection ${detectionId} created by admin ${adminUser.email}`);

    // 6. Optionally trigger the full pipeline
    let pipelineResult = null;
    if (triggerPipeline) {
      try {
        const requestUrl = new URL(request.url);
        const isLocalhost = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
        const baseUrl = isLocalhost
          ? `${requestUrl.protocol}//${requestUrl.host}`
          : (process.env.NEXT_PUBLIC_APP_URL || `${requestUrl.protocol}//${requestUrl.host}`);

        const pipelineResponse = await fetch(`${baseUrl}/api/detections/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ detectionId }),
        });

        pipelineResult = await pipelineResponse.json();
        console.log(`[Simulate] Pipeline result for ${detectionId}:`, pipelineResult);
      } catch (pipelineError: any) {
        console.error('[Simulate] Pipeline trigger error:', pipelineError);
        pipelineResult = { error: pipelineError.message, success: false };
      }
    }

    return NextResponse.json({
      success: true,
      detection: insertedDetection,
      pipeline: pipelineResult,
      message: `Simulated ${species} detection created${triggerPipeline ? ' and pipeline triggered' : ''}`,
    });
  } catch (error: any) {
    console.error('[Simulate] Error:', error);
    const status = error.message === 'Unauthorized' ? 401
      : error.message === 'Forbidden' ? 403
      : 500;
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status }
    );
  }
}
