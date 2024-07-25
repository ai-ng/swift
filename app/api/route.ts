/*
TODO:
1) Benchmark each part of the pipeline, in particular, transcription seperately, first buffer to translation, and first buffer to voice generation. 
2) Get feedback on the particular method I am using to send buffer and see if this is good 
Would be nice to do a before and after continuations
Benchmark on A05 
*/

// route.ts

// ------ WITH STREAMING -------
import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";

const groq = new Groq();

const schema = zfd.formData({
  input: z.union([zfd.text(), z.any()]),
  message: zfd.repeatableOfType(
    zfd.json(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
  ),
});

let cartesiaContextId: string | null = null;

async function* generateStream(transcript: string) {
  const stream = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    messages: [
      {
        role: "system",
        content: `You are a TRANSLATOR. ONLY TRANSLATE THE INPUT TEXT INTO THE TARGET LANGUAGE.`,
      },
      {
        role: "user",
        content: `Translate the following sentence into English; ONLY INCLUDE TRANSLATION, NOTHING ELSE: ${transcript}`,
      },
    ],
    temperature: 0.5,
    max_tokens: 1024,
    stream: true,
  });

  let buffer = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      buffer += content;
      if (buffer.length >= 20 || buffer.includes('.')) {
		console.log(buffer);
        yield buffer
        buffer = "";
      }
    }
  }

  if (buffer) {
    yield buffer;
  }
}

export async function POST(request: Request) {
  const { data, success } = schema.safeParse(await request.formData());
  if (!success) return new Response("Invalid request", { status: 400 });

  const transcript = await getTranscript(data.input);
  if (!transcript) return new Response("Invalid audio", { status: 400 });

  cartesiaContextId = crypto.randomUUID();

  const stream = generateStream(transcript);

  const encoder = new TextEncoder();

  return new Response(new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Transcript': encodeURIComponent(transcript),
      'X-Cartesia-Context-Id': cartesiaContextId,
    },
  });
}

async function getTranscript(input: string | File) {
  if (typeof input === "string") return input;

  try {
    const { text } = await groq.audio.transcriptions.create({
      file: input,
      model: "whisper-large-v3",
      language: "hi"
    });

    return text.trim() || null;
  } catch {
    return null; // Empty audio file
  }
}



// ---------- BEFORE CODE, NO STREAMING ----------
// import Groq from "groq-sdk";
// import { headers } from "next/headers";
// import { z } from "zod";
// import { zfd } from "zod-form-data";
// import { unstable_after as after } from "next/server";

// const groq = new Groq();

// const schema = zfd.formData({
// 	input: z.union([zfd.text(), z.any()]),
// 	message: zfd.repeatableOfType(
// 		zfd.json(
// 			z.object({
// 				role: z.enum(["user", "assistant"]),
// 				content: z.string(),
// 			})
// 		)
// 	),
// });

// export async function POST(request: Request) {
// 	console.time("transcribe " + request.headers.get("x-vercel-id") || "local");

// 	const { data, success } = schema.safeParse(await request.formData());
// 	if (!success) return new Response("Invalid request", { status: 400 });

// 	const transcript = await getTranscript(data.input);
// 	if (!transcript) return new Response("Invalid audio", { status: 400 });

// 	console.timeEnd(
// 		"transcribe " + request.headers.get("x-vercel-id") || "local"
// 	);
// 	console.time(
// 		"text completion " + request.headers.get("x-vercel-id") || "local"
// 	);

// 	console.log("TRANSCRIPT:", transcript)

// 	const completion = await groq.chat.completions.create({
// 		model: "llama3-8b-8192",
// 		messages: [
// 			{
// 				role: "system",
// 				content: `- You are only to translate the users text from Hindi into English. DO NOT DO ANYTHING ELSE. TRANSLATE EXACTLY AS RECIEVED`,
// 			},
// 			...data.message,
// 			{
// 				role: "user",
// 				content: transcript,
// 			},
// 		],
// 		// stream: true,
// 	});

// 	const response = completion.choices[0].message.content;
// 	console.timeEnd(
// 		"text completion " + request.headers.get("x-vercel-id") || "local"
// 	);

// 	console.time(
// 		"cartesia request " + request.headers.get("x-vercel-id") || "local"
// 	);

// 	const voice = await fetch("https://api.cartesia.ai/tts/bytes", {
// 		method: "POST",
// 		headers: {
// 			"Cartesia-Version": "2024-06-30",
// 			"Content-Type": "application/json",
// 			"X-API-Key": process.env.CARTESIA_API_KEY!,
// 		},
// 		body: JSON.stringify({
// 			model_id: "sonic-english",
// 			transcript: response,
// 			voice: {
// 				mode: "id",
// 				id: "79a125e8-cd45-4c13-8a67-188112f4dd22",
// 			},
// 			output_format: {
// 				container: "raw",
// 				encoding: "pcm_f32le",
// 				sample_rate: 24000,
// 			},
// 		}),
// 	});

// 	console.timeEnd(
// 		"cartesia request " + request.headers.get("x-vercel-id") || "local"
// 	);

// 	if (!voice.ok) {
// 		console.error(await voice.text());
// 		return new Response("Voice synthesis failed", { status: 500 });
// 	}

// 	console.time("stream " + request.headers.get("x-vercel-id") || "local");
// 	after(() => {
// 		console.timeEnd(
// 			"stream " + request.headers.get("x-vercel-id") || "local"
// 		);
// 	});

// 	return new Response(voice.body, {
// 		headers: {
// 			"X-Transcript": encodeURIComponent(transcript),
// 			"X-Response": encodeURIComponent(response),
// 		},
// 	});
// }

// function location() {
// 	const headersList = headers();

// 	const country = headersList.get("x-vercel-ip-country");
// 	const region = headersList.get("x-vercel-ip-country-region");
// 	const city = headersList.get("x-vercel-ip-city");

// 	if (!country || !region || !city) return "unknown";

// 	return `${city}, ${region}, ${country}`;
// }

// function time() {
// 	return new Date().toLocaleString("en-US", {
// 		timeZone: headers().get("x-vercel-ip-timezone") || undefined,
// 	});
// }

// async function getTranscript(input: string | File) {
// 	if (typeof input === "string") return input;

// 	try {
// 		const { text } = await groq.audio.transcriptions.create({
// 			file: input,
// 			model: "whisper-large-v3",
// 			language: "hi"
// 		});

// 		return text.trim() || null;
// 	} catch {
// 		return null; // Empty audio file
// 	}
// }
