import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const maxDuration = 60;

interface ClassificationResult {
  species: string;
  venomous: boolean;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  firstAid?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { detectionId, triggerPipeline } = body;
    
    if (!detectionId) {
      return NextResponse.json(
        { error: 'Detection ID is required' },
        { status: 400 }
      );
    }

    console.log('Starting classification for:', detectionId);

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: detection, error: fetchError } = await supabaseAdmin
      .from('snake_detections')
      .select('id, image_url, venomous')
      .eq('id', detectionId)
      .single();

    if (fetchError || !detection) {
      console.error('Detection not found:', fetchError);
      return NextResponse.json(
        { error: 'Detection not found' },
        { status: 404 }
      );
    }

    if (detection.venomous !== null && detection.venomous !== undefined) {
      console.log('Already classified, skipping');
      return NextResponse.json({
        success: true,
        message: 'Already classified',
        alreadyClassified: true
      });
    }

    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    console.log('Fetching image from:', detection.image_url.substring(0, 100));

    let imageResponse;
    try {
      imageResponse = await fetch(detection.image_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: HTTP ${imageResponse.status}`);
      }
    } catch (fetchError: any) {
      console.error('Image fetch error:', fetchError);
      throw new Error(`Cannot access image: ${fetchError.message}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    console.log('Image processed:', {
      size: `${(imageBuffer.byteLength / 1024).toFixed(2)}KB`,
      mimeType
    });

    // Shorter prompt to reduce token usage and avoid MAX_TOKENS
    const prompt = `You are a herpetologist expert specializing in global snake species identification. Analyze this snake image and provide the best possible match.

Important:
- Identify the snake species accurately even if it is NOT native to India.
- Do NOT force-match the snake to an Indian species if the correct species is from another country.
- If uncertain, return "unknown" and confidence 0.0 instead of guessing.
- Respond strictly in the JSON format below.

Required fields and output format (do not change field names or order):
{
  "species": "species name",
  "venomous": true/false,
  "confidence": 0.0-1.0,
  "riskLevel": "critical|high|medium|low",
  "description": "brief description",
  "firstAid": "first aid guidance if venomous, empty string if not"
}

Risk level rules:
- "critical" = extremely venomous and life-threatening (cobra, krait, viper, taipan, mamba, etc.)
- "high" = venomous but generally less fatal with treatment
- "medium" = mildly venomous or non-fatal to healthy adults
- "low" = non-venomous and harmless

Do not return any text outside of the JSON object. No markdown or comments.`;

    console.log('Calling Gemini API...');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 4096,  // Increased to handle longer responses
          }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { rawError: errorText };
      }
      
      console.error('Gemini API error response:', {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        error: errorData
      });
      
      throw new Error(`Gemini API failed: ${geminiResponse.status} - ${errorData?.error?.message || errorText.substring(0, 200)}`);
    }

    const data = await geminiResponse.json();
    
    console.log('Gemini API raw response:', JSON.stringify(data, null, 2));
    
    if (data.promptFeedback?.blockReason) {
      console.error('Content blocked by safety filters:', data.promptFeedback);
      throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
    }
    
    let text = '';
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.warn('Unusual finish reason:', candidate.finishReason);
        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Response blocked by safety filters');
        }
        // MAX_TOKENS means response was truncated, but might still have partial content
        if (candidate.finishReason === 'MAX_TOKENS') {
          console.warn('Response hit MAX_TOKENS limit - attempting to extract partial content');
        }
      }
      
      // Extract text from all parts (not just first one)
      if (candidate.content?.parts && candidate.content.parts.length > 0) {
        text = candidate.content.parts
          .map((part: any) => part.text || '')
          .filter((t: string) => t.length > 0)
          .join('\n');
      }
    }

    if (!text || text.trim().length === 0) {
      console.error('Failed to extract text from Gemini response:', {
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length,
        firstCandidate: data.candidates?.[0],
        finishReason: data.candidates?.[0]?.finishReason,
        hasContent: !!data.candidates?.[0]?.content,
        hasParts: !!data.candidates?.[0]?.content?.parts,
        partsLength: data.candidates?.[0]?.content?.parts?.length,
        fullResponse: JSON.stringify(data, null, 2)
      });
      throw new Error('Empty response from Gemini API - check server logs for details');
    }

    console.log('Gemini response text extracted, length:', text.length);

    let classification: ClassificationResult;
    try {
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : cleanedText;
      
      classification = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      classification = {
        species: 'Unknown Snake',
        venomous: true,
        confidence: 0.3,
        riskLevel: 'high',
        description: 'Unable to classify. Treat as potentially dangerous.',
        firstAid: 'Seek immediate medical attention.'
      };
    }

    if (!classification.species) classification.species = 'Unknown Snake';
    if (typeof classification.venomous !== 'boolean') classification.venomous = true;
    if (!classification.confidence || classification.confidence < 0 || classification.confidence > 1) {
      classification.confidence = 0.5;
    }
    if (!['low', 'medium', 'high', 'critical'].includes(classification.riskLevel)) {
      classification.riskLevel = classification.venomous ? 'high' : 'low';
    }

    console.log('Classification result:', classification);

    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from('snake_detections')
      .update({
        species: classification.species,
        venomous: classification.venomous,
        risk_level: classification.riskLevel,
        classification_confidence: classification.confidence,
        classification_description: classification.description,
        classification_first_aid: classification.firstAid,
        classified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', detectionId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    console.log('Classification complete and saved!', {
      detectionId,
      species: updatedData?.species,
      venomous: updatedData?.venomous,
      risk_level: updatedData?.risk_level
    });

    // Optionally trigger full pipeline if requested
    if (triggerPipeline === true) {
      try {
        // Trigger pipeline asynchronously (don't wait for it)
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/detections/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ detectionId }),
        }).catch(err => console.warn('[Classify] Pipeline trigger failed:', err));
      } catch (err) {
        // Non-blocking, just log
        console.warn('[Classify] Failed to trigger pipeline:', err);
      }
    }

    return NextResponse.json({
      success: true,
      classification
    });

  } catch (error: any) {
    console.error('Classification error:', error);
    
    try {
      const supabaseAdmin = getSupabaseAdminClient();
      const body = await request.json().catch(() => ({}));
      const detectionId = body.detectionId;
      
      if (detectionId) {
        await supabaseAdmin
          .from('snake_detections')
          .update({ 
            notes: `Classification failed: ${error.message}`,
            updated_at: new Date().toISOString() 
          })
          .eq('id', detectionId);
      }
    } catch (e) {
      // Non-critical error logging
      console.warn('Failed to update detection with error note:', e);
    }
    
    return NextResponse.json(
      { 
        error: 'Classification failed',
        message: error.message 
      },
      { status: 500 }
    );
  }
}