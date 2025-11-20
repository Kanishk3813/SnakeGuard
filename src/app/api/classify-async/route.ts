import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    const { detectionId } = await request.json();
    
    if (!detectionId) {
      return NextResponse.json(
        { error: 'Detection ID is required' },
        { status: 400 }
      );
    }

    console.log('Starting classification for:', detectionId);

    const { data: detection, error: fetchError } = await supabase
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

    const prompt = `You are a herpetologist expert specializing in Indian snake species identification. Analyze this snake image and provide:

1. **Species Name**: Identify the exact species (scientific name if possible, common name otherwise)
2. **Venomous Status**: Is this snake venomous? (true/false)
3. **Confidence**: Your confidence level (0.0 to 1.0)
4. **Risk Assessment**: 
   - "critical" if highly venomous (cobra, krait, viper)
   - "high" if venomous but less dangerous
   - "medium" if potentially dangerous but not venomous
   - "low" if non-venomous and harmless
5. **Brief Description**: 1-2 sentences about the snake
6. **First Aid Notes**: If venomous, provide basic first aid guidance

Common Indian snake species to consider:
- Venomous: Indian Cobra, Russell's Viper, Common Krait, Saw-scaled Viper, King Cobra
- Non-venomous: Indian Python, Rat Snake, Common Sand Boa, Wolf Snake, Keelback

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "species": "species name",
  "venomous": true/false,
  "confidence": 0.0-1.0,
  "riskLevel": "critical|high|medium|low",
  "description": "brief description",
  "firstAid": "first aid guidance if venomous, empty string if not"
}`;

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
            maxOutputTokens: 2048,
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
      }
      
      if (candidate.content?.parts && candidate.content.parts.length > 0) {
        text = candidate.content.parts[0].text || '';
      }
    }

    if (!text) {
      console.error('Failed to extract text from Gemini response:', {
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length,
        firstCandidate: data.candidates?.[0],
        fullResponse: data
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

    const { error: updateError } = await supabase
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
      .eq('id', detectionId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    console.log('Classification complete and saved!');

    return NextResponse.json({
      success: true,
      classification
    });

  } catch (error: any) {
    console.error('Classification error:', error);
    
    try {
      await supabase
        .from('snake_detections')
        .update({ 
          notes: `Classification failed: ${error.message}`,
          updated_at: new Date().toISOString() 
        })
        .eq('id', request.body ? JSON.parse(await request.text()).detectionId : null);
    } catch (e) {
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