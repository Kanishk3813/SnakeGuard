import { NextRequest, NextResponse } from 'next/server';
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

/**
 * POST /api/classify-image
 *
 * Accepts a base64 image directly from the mobile app and classifies the snake
 * using Google Gemini AI. Optionally links the result to an existing detection.
 *
 * Body:
 *   imageBase64: string    – base64-encoded image data (no data URI prefix)
 *   mimeType?: string      – e.g. "image/jpeg" (default)
 *   detectionId?: string   – optional detection to update with classification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType = 'image/jpeg', detectionId } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'imageBase64 is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured on server' },
        { status: 500 }
      );
    }

    // ── Call Gemini Vision API ──────────────────────────────────────────
    const prompt = `You are a herpetologist expert specializing in global snake species identification. Analyze this snake image and provide the best possible match.

Important:
- Identify the snake species accurately even if it is NOT native to India.
- Do NOT force-match the snake to an Indian species if the correct species is from another country.
- If the image does not contain a snake, respond with species "Not a snake" and confidence 0.0.
- If uncertain, return "Unknown Snake" and confidence below 0.3 instead of guessing.
- Respond strictly in the JSON format below.

Required fields and output format (do not change field names or order):
{
  "species": "species name",
  "venomous": true/false,
  "confidence": 0.0-1.0,
  "riskLevel": "critical|high|medium|low",
  "description": "brief description of the species, appearance, and behavior",
  "firstAid": "first aid guidance if venomous, empty string if not"
}

Risk level rules:
- "critical" = extremely venomous and life-threatening (cobra, krait, viper, taipan, mamba, etc.)
- "high" = venomous but generally less fatal with treatment
- "medium" = mildly venomous or non-fatal to healthy adults
- "low" = non-venomous and harmless

Do not return any text outside of the JSON object. No markdown or comments.`;

    console.log('[classify-image] Calling Gemini API…');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[classify-image] Gemini error:', errorText.substring(0, 300));
      throw new Error(`Gemini API failed: ${geminiResponse.status}`);
    }

    const data = await geminiResponse.json();

    // Extract text
    let text = '';
    if (data.candidates?.[0]?.content?.parts) {
      text = data.candidates[0].content.parts
        .map((p: any) => p.text || '')
        .filter((t: string) => t.length > 0)
        .join('\n');
    }

    if (!text.trim()) {
      throw new Error('Empty response from Gemini API');
    }

    // Parse JSON
    let classification: ClassificationResult;
    try {
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      classification = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      classification = {
        species: 'Unknown Snake',
        venomous: true,
        confidence: 0.3,
        riskLevel: 'high',
        description: 'Unable to classify. Treat as potentially dangerous.',
        firstAid: 'Seek immediate medical attention.',
      };
    }

    // Sanitise
    if (!classification.species) classification.species = 'Unknown Snake';
    if (typeof classification.venomous !== 'boolean') classification.venomous = true;
    if (
      !classification.confidence ||
      classification.confidence < 0 ||
      classification.confidence > 1
    ) {
      classification.confidence = 0.5;
    }
    if (!['low', 'medium', 'high', 'critical'].includes(classification.riskLevel)) {
      classification.riskLevel = classification.venomous ? 'high' : 'low';
    }

    console.log('[classify-image] Result:', classification.species, classification.riskLevel);

    // ── Optionally update an existing detection ────────────────────────
    if (detectionId) {
      try {
        const supabaseAdmin = getSupabaseAdminClient();
        await supabaseAdmin
          .from('snake_detections')
          .update({
            species: classification.species,
            venomous: classification.venomous,
            risk_level: classification.riskLevel,
            classification_confidence: classification.confidence,
            classification_description: classification.description,
            classification_first_aid: classification.firstAid,
            classified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', detectionId);

        console.log('[classify-image] Updated detection', detectionId);
      } catch (dbErr) {
        console.warn('[classify-image] Failed to update detection:', dbErr);
        // Non-fatal — still return classification to the user
      }
    }

    return NextResponse.json({
      success: true,
      classification,
      detectionId: detectionId || null,
    });
  } catch (error: any) {
    console.error('[classify-image] Error:', error);
    return NextResponse.json(
      { error: 'Classification failed', message: error.message },
      { status: 500 }
    );
  }
}
