import { NextResponse } from 'next/server';

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
    const { imageUrl, detectionId } = await request.json();
    
    console.log('Classification request received:', { 
      hasImageUrl: !!imageUrl, 
      imageUrlPreview: imageUrl?.substring(0, 100),
      detectionId 
    });
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in environment variables');
      return NextResponse.json(
        { 
          error: 'Gemini API key not configured',
          message: 'Please set GEMINI_API_KEY in your .env.local file'
        },
        { status: 500 }
      );
    }
    
    console.log('Gemini API key found, length:', apiKey.length);

    // Fetch the image
    let imageResponse;
    try {
      console.log('Fetching image from:', imageUrl);
      imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log('Image fetch response:', {
        status: imageResponse.status,
        statusText: imageResponse.statusText,
        headers: Object.fromEntries(imageResponse.headers.entries())
      });
      
      if (!imageResponse.ok) {
        return NextResponse.json(
          { 
            error: 'Failed to fetch image',
            message: `HTTP ${imageResponse.status}: ${imageResponse.statusText}`,
            imageUrl: imageUrl.substring(0, 100)
          },
          { status: 400 }
        );
      }
    } catch (fetchError: any) {
      console.error('Image fetch error:', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch image',
          message: fetchError.message || 'Network error or invalid image URL'
        },
        { status: 400 }
      );
    }

    let imageBuffer: ArrayBuffer;
    let mimeType: string;
    try {
      imageBuffer = await imageResponse.arrayBuffer();
      mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
      
      console.log('Image processed:', {
        size: imageBuffer.byteLength,
        mimeType
      });
      
      if (imageBuffer.byteLength === 0) {
        return NextResponse.json(
          { error: 'Image is empty or invalid' },
          { status: 400 }
        );
      }

      // Check if image is too large (max 20MB for Gemini)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (imageBuffer.byteLength > maxSize) {
        return NextResponse.json(
          { 
            error: 'Image too large',
            message: `Image size ${(imageBuffer.byteLength / 1024 / 1024).toFixed(2)}MB exceeds 20MB limit`
          },
          { status: 400 }
        );
      }
    } catch (bufferError: any) {
      console.error('Image buffer error:', bufferError);
      return NextResponse.json(
        { 
          error: 'Failed to process image',
          message: bufferError.message
        },
        { status: 400 }
      );
    }
    
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    // Create classification prompt
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

    // Use REST API with correct model name from official docs
    console.log('Sending request to Gemini API...', {
      imageSize: `${(imageBase64.length / 1024).toFixed(2)}KB`,
      mimeType,
      model: 'gemini-2.5-flash'
    });
    
    // Use v1beta API with gemini-2.5-flash model
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiApiUrl, {
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
    });
    
    console.log('Gemini API response status:', geminiResponse.status);
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { rawError: errorText };
      }
      
      console.error('Gemini API error:', {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        error: errorData
      });
      
      // Check for common errors
      let errorMessage = 'Unknown error';
      if (geminiResponse.status === 400) {
        errorMessage = 'Invalid request to Gemini API. Check image format and size.';
      } else if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        errorMessage = 'Invalid or unauthorized API key. Please check your GEMINI_API_KEY.';
      } else if (geminiResponse.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (errorData?.error?.message) {
        errorMessage = errorData.error.message;
      }
      
      return NextResponse.json(
        { 
          error: 'Gemini API request failed',
          message: errorMessage,
          details: process.env.NODE_ENV === 'development' ? errorData : undefined,
          status: geminiResponse.status
        },
        { status: 500 }
      );
    }
    
    const data = await geminiResponse.json();
    console.log('Gemini API response structure:', {
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length
    });
    
    let text = '';
    if (data.candidates && data.candidates[0]?.content?.parts) {
      text = data.candidates[0].content.parts[0].text || '';
    }
    
    if (!text) {
      console.error('Empty response from Gemini API:', JSON.stringify(data, null, 2));
      return NextResponse.json(
        { 
          error: 'Empty response from Gemini API',
          message: 'The API returned no text content',
          details: process.env.NODE_ENV === 'development' ? data : undefined
        },
        { status: 500 }
      );
    }
    
    console.log('Gemini response text (first 200 chars):', text.substring(0, 200));
    
    // Parse JSON response
    let classification: ClassificationResult;
    try {
      // Remove markdown code blocks if present
      let cleanedText = text.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      // Extract JSON object
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : cleanedText;
      
      classification = JSON.parse(jsonText);
      console.log('Parsed classification:', classification);
    } catch (parseError: any) {
      console.error('Failed to parse classification response:', {
        error: parseError.message,
        text: text.substring(0, 500)
      });
      
      // Fallback classification
      classification = {
        species: 'Unknown Snake',
        venomous: true,
        confidence: 0.3,
        riskLevel: 'high',
        description: 'Unable to classify. Treat as potentially dangerous.',
        firstAid: 'Seek immediate medical attention. Keep the affected area immobilized and below heart level.'
      };
    }

    // Validate and normalize the response
    if (!classification.species) {
      classification.species = 'Unknown Snake';
    }
    if (typeof classification.venomous !== 'boolean') {
      classification.venomous = true;
    }
    if (!classification.confidence || classification.confidence < 0 || classification.confidence > 1) {
      classification.confidence = 0.5;
    }
    if (!['low', 'medium', 'high', 'critical'].includes(classification.riskLevel)) {
      classification.riskLevel = classification.venomous ? 'high' : 'low';
    }

    console.log('Final classification result:', classification);

    return NextResponse.json({
      success: true,
      classification
    });

  } catch (error: any) {
    console.error('Classification error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json(
      { 
        error: 'Classification failed',
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}