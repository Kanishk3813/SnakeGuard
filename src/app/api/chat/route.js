import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { messages } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Missing Gemini API key',
        details: 'Please set GEMINI_API_KEY in your .env.local file'
      }, { status: 500 });
    }
    
    const lastUserMessage = messages[messages.length - 1].content;
    
    let conversationContext = '';
    if (messages.length > 1) {
      const contextMessages = messages.slice(-6, -1);
      for (const msg of contextMessages) {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        conversationContext += `${role}: ${msg.content}\n`;
      }
    }

    const fullPrompt = conversationContext + 
      "You are a helpful assistant for a snake detection system. " +
      "Provide information about snakes, detection systems, and safety measures.\n\n" +
      lastUserMessage;
    
    // Use REST API (more reliable than SDK)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: fullPrompt }]
          }]
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      return NextResponse.json({ 
        error: 'Gemini API request failed',
        details: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      }, { status: 500 });
    }
    
    const data = await response.json();
    
    let textResponse = '';
    if (data.candidates && data.candidates[0]?.content?.parts) {
      textResponse = data.candidates[0].content.parts[0].text || '';
    }
    
    if (!textResponse) {
      return NextResponse.json({ 
        error: 'Empty response from Gemini API',
        details: 'The API returned no text content'
      }, { status: 500 });
    }
    
    return NextResponse.json({ response: textResponse });
  } catch (error) {
    console.error('Error processing chat request:', error);
    return NextResponse.json({ 
      error: 'Error processing your request', 
      details: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}