import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Automatically classify a detection when it's created
 * This endpoint is called by a database trigger or webhook
 */
export async function POST(request: Request) {
  try {
    const { detectionId } = await request.json();
    
    if (!detectionId) {
      return NextResponse.json(
        { error: 'Detection ID is required' },
        { status: 400 }
      );
    }

    // Fetch detection data
    const { data: detection, error: fetchError } = await supabase
      .from('snake_detections')
      .select('id, image_url, species, venomous')
      .eq('id', detectionId)
      .single();

    if (fetchError || !detection) {
      return NextResponse.json(
        { error: 'Detection not found' },
        { status: 404 }
      );
    }

    // Skip if already classified
    if (detection.venomous !== null && detection.species) {
      return NextResponse.json({
        success: true,
        message: 'Already classified',
        classification: {
          species: detection.species,
          venomous: detection.venomous
        }
      });
    }

    // Call classification API
    const classifyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl: detection.image_url,
        detectionId: detection.id
      })
    });

    if (!classifyResponse.ok) {
      throw new Error('Classification API failed');
    }

    const { classification } = await classifyResponse.json();

    // Update detection with classification results
    const { error: updateError } = await supabase
      .from('snake_detections')
      .update({
        species: classification.species,
        venomous: classification.venomous,
        risk_level: classification.riskLevel,
        classification_confidence: classification.confidence,
        classification_description: classification.description,
        classification_first_aid: classification.firstAid,
        classified_at: new Date().toISOString()
      })
      .eq('id', detectionId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      classification
    });

  } catch (error: any) {
    console.error('Auto-classification error:', error);
    return NextResponse.json(
      { 
        error: 'Classification failed',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

