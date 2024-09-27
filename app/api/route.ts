import Groq from "groq-sdk";
import OpenAI from "openai";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { unstable_after as after } from "next/server";

// Remove node-fetch import as fetch is available globally in Node.js 18+
const groq = new Groq();

// Ensure environment variables are defined
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const BLAND_AI_API_KEY = process.env.BLAND_AI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment variables.");
}

if (!CARTESIA_API_KEY) {
  throw new Error("Missing CARTESIA_API_KEY in environment variables.");
}

if (!BLAND_AI_API_KEY) {
  throw new Error("Missing BLAND_AI_API_KEY in environment variables.");
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Updated schema to include phone_number and task
const schema = zfd.formData({
  input: z.union([zfd.text(), zfd.file()]), // Updated line
  message: zfd.repeatableOfType(
    zfd.json(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
  ),
  phone_number: zfd.text().optional(), // New parameter for phone number, made optional
  task: zfd.text().optional(), // New parameter for task, made optional
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = schema.safeParse(formData);

  if (!result.success) {
    console.error("Invalid request data:", result.error);
    return new Response("Invalid request", { status: 400 });
  }

  const data = result.data;
  console.time('transcribe'); // Add this line
  const transcript = await getTranscript(data.input);
  if (!transcript) {
    console.error("Transcript is null.");
    return new Response("Invalid audio", { status: 400 });
  }
  console.timeEnd('transcribe');

  console.time(`text completion`);
  let completion;
  try {
    const functions = [
      {
        name: "location",
        description: "Get the user's current location based on request headers.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "time",
        description: "Get the current time based on the user's timezone.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "makeBlandAICall",
        description:
          "Initiate a call via Bland AI with the provided phone number and task.",
        parameters: {
          type: "object",
          properties: {
            phone_number: {
              type: "string",
              description: "The phone number to call.",
            },
            task: {
              type: "string",
              description: "The task to perform during the call.",
            },
          },
          required: ["phone_number", "task"],
        },
      },
    ];

    const messages = [
      {
        role: "system",
        content: `- You are Swift, a friendly and helpful voice assistant.
- Respond briefly to the user's request, and do not provide unnecessary information.
- If you don't understand the user's request, ask for clarification.
- Do not use markdown, emojis, or other formatting in your responses. Respond in a way easily spoken by text-to-speech software.
- User location is obtained via the function 'location'.
- The current time is obtained via the function 'time'.
- Your large language model is GPT-4o-mini, used via the function call feature.
- Your text-to-speech model is Sonic, created and hosted by Cartesia, a company that builds fast and realistic speech synthesis technology.`,
      },
      ...data.message,
      {
        role: "user",
        content: transcript,
      },
    ];

    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      functions: functions,
      function_call: "auto",
    });

    // Handle any function calls made by the assistant
    let assistantMessage = completion.choices[0].message;

    while (assistantMessage.function_call) {
      const functionName = assistantMessage.function_call.name;
      let functionResponse = "";

      if (functionName === "location") {
        functionResponse = location();
      } else if (functionName === "time") {
        functionResponse = time();
      } else if (functionName === "makeBlandAICall") {
        // Parse the arguments from JSON string to object
        const args = JSON.parse(assistantMessage.function_call.arguments);
        const { phone_number, task } = args;
        functionResponse = await makeBlandAICall(phone_number, task);
      } else {
        functionResponse = "Function not implemented";
      }

      messages.push(assistantMessage);
      messages.push({
        role: "function",
        name: functionName,
        content: functionResponse,
      });

      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
      });

      assistantMessage = completion.choices[0].message;
    }
  } catch (error) {
    console.error("Text Completion Error:", error);
    return new Response("Text completion failed", { status: 500 });
  }

  if (
    !completion ||
    !completion.choices ||
    !completion.choices[0]?.message?.content
  ) {
    console.error("Invalid completion response:", completion);
    return new Response("Text completion failed", { status: 500 });
  }

  const response = completion.choices[0].message.content;
  console.timeEnd(`text completion`);

  console.time(`cartesia request`);
  let voice;
  try {
    voice = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "Cartesia-Version": "2024-06-30",
        "Content-Type": "application/json",
        "X-API-Key": CARTESIA_API_KEY,
      },
      body: JSON.stringify({
        model_id: "sonic-english",
        transcript: response,
        voice: {
          mode: "id",
          id: "79a125e8-cd45-4c13-8a67-188112f4dd22",
        },
        output_format: {
          container: "raw",
          encoding: "pcm_f32le",
          sample_rate: 24000,
        },
      }),
    });
  } catch (error) {
    console.error("Cartesia Request Error:", error);
    return new Response("Voice synthesis failed", { status: 500 });
  }

  console.timeEnd(`cartesia request`);

  if (!voice.ok) {
    const errorText = await voice.text();
    console.error("Cartesia API Error:", errorText);
    return new Response("Voice synthesis failed", { status: 500 });
  }

  console.time(`stream`);
  after(() => {
    console.timeEnd(`stream`);
  });

  return new Response(voice.body, {
    headers: {
      "X-Transcript": encodeURIComponent(transcript),
      "X-Response": encodeURIComponent(response),
    },
  });
}

// Updated Helper function to handle Bland AI call
async function makeBlandAICall(phone_number: string, task: string): Promise<string> {
  const options = {
    method: "POST",
    headers: {
      authorization: BLAND_AI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone_number: phone_number,
      task: task,
      voice: "Derek",
      wait_for_greeting: true,
      block_interruptions: true,
      model: "enhanced",
      language: "en-US",
      webhook: null,
      metadata: {
        caller: "Derek",
        purpose: "Inquire about discount Mooncake",
      },
      max_duration: 30,
      record: true,
      summary_prompt: "Summarize the key points of the conversation, including any actions or decisions made.",
      analysis_schema: {
        customer_name: "string",
        interested_in_discount: "boolean",
        preferred_contact_method: "string",
        follow_up_date: "YYYY-MM-DD"
      },
      answered_by_enabled: true
    }),
  };

  try {
    const response = await fetch("https://api.bland.ai/v1/calls", options);
    const data = await response.json();
    console.log("Bland AI Call Response:", data);
    return JSON.stringify(data);
  } catch (err) {
    console.error("Error making Bland AI call:", err);
    return JSON.stringify({ status: "error", message: "Voice synthesis failed" });
  }
}

// Existing Helper functions

function location(): string {
  const headersList = headers();

  const country = headersList.get("x-vercel-ip-country");
  const region = headersList.get("x-vercel-ip-country-region");
  const city = headersList.get("x-vercel-ip-city");

  if (!country || !region || !city) return "unknown";

  return `${city}, ${region}, ${country}`;
}

function time(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: headers().get("x-vercel-ip-timezone") || undefined,
  });
}

async function getTranscript(input: string | File): Promise<string | null> {
  if (typeof input === "string") return input;

  try {
    const { text } = await groq.audio.transcriptions.create({
      file: input,
      model: "whisper-large-v3",
    });

    return text.trim() || null;
  } catch {
    return null; // Empty audio file
  }
}