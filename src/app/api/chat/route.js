import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { messages } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('Missing Gemini API key');
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
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    let textResponse = '';
    if (data.candidates && data.candidates[0]?.content?.parts) {
      textResponse = data.candidates[0].content.parts[0].text || '';
    }
    
    if (!textResponse) {
      throw new Error('Empty response from Gemini API');
    }
    
    return NextResponse.json({ response: textResponse });
  } catch (error) {
    console.error('Error processing chat request:', error);
    return NextResponse.json({ 
      error: 'Error processing your request', 
      details: error.message 
    }, { status: 500 });
  }
}