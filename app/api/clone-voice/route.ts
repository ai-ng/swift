import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log("Received request to clone voice");
  try {
    const formData = await request.formData();
    const voiceSample = formData.get('voiceSample') as File;

    if (!voiceSample) {
      console.error("No voice sample provided");
      return NextResponse.json({ error: 'No voice sample provided' }, { status: 400 });
    }

    console.log("Voice sample received, attempting to clone");
    console.log("File name:", voiceSample.name);
    console.log("File type:", voiceSample.type);
    console.log("File size:", voiceSample.size);

    const form = new FormData();
    const buffer = await voiceSample.arrayBuffer();
    form.append("clip", new Blob([buffer]), voiceSample.name);

    const cloneOptions = {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': process.env.CARTESIA_API_KEY!,
      },
      body: form
    };

    const cloneResponse = await fetch('https://api.cartesia.ai/voices/clone/clip', cloneOptions);

    if (!cloneResponse.ok) {
      const errorText = await cloneResponse.text();
      console.error('Cartesia API error response:', errorText);
      return NextResponse.json({ error: 'Failed to clone voice', details: errorText }, { status: cloneResponse.status });
    }

    const clonedVoice = await cloneResponse.json();
    console.log("Cartesia API clone response:", JSON.stringify(clonedVoice, null, 2));

    if (!Array.isArray(clonedVoice.embedding) || clonedVoice.embedding.length === 0) {
      console.error('Cartesia API response does not contain a valid embedding');
      return NextResponse.json({ error: 'Invalid response from Cartesia API', details: 'No valid embedding in response' }, { status: 500 });
    }

    // Now, create a voice with the embedding
    const createVoiceOptions = {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': process.env.CARTESIA_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Cloned Voice ${Date.now()}`,
        description: "A voice cloned from an audio sample.",
        embedding: clonedVoice.embedding
      })
    };

    const createResponse = await fetch('https://api.cartesia.ai/voices', createVoiceOptions);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Cartesia API error response (create voice):', errorText);
      return NextResponse.json({ error: 'Failed to create voice', details: errorText }, { status: createResponse.status });
    }

    const createdVoice = await createResponse.json();
    console.log("Voice created successfully, ID:", createdVoice.id);
    
    return NextResponse.json({ voiceId: createdVoice.id });
  } catch (error) {
    console.error('Error cloning and creating voice:', error);
    return NextResponse.json({ error: 'Failed to clone and create voice', details: error.message }, { status: 500 });
  }
}