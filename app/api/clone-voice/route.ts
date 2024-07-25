import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';

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

    const options = {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10', 
        'X-API-Key': process.env.CARTESIA_API_KEY!,
      },
      body: form
    };

    const response = await fetch('https://api.cartesia.ai/voices/clone/clip', options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cartesia API error response:', errorText);
      return NextResponse.json({ error: 'Failed to clone voice', details: errorText }, { status: response.status });
    }

    const clonedVoice = await response.json();
    console.log("Voice cloned successfully, ID:", clonedVoice.id);
    return NextResponse.json({ voiceId: clonedVoice.id });
  } catch (error) {
    console.error('Error cloning voice:', error);
    return NextResponse.json({ error: 'Failed to clone voice', details: error.message }, { status: 500 });
  }
}