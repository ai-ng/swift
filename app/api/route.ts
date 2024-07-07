import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { unstable_after as after } from "next/server";

const groq = new Groq();

const schema = zfd.formData({
  input: z.union([zfd.text(), zfd.file()]),
  message: zfd.repeatableOfType(
    zfd.json(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
  ),
});

export async function POST(request: Request) {
  console.time("transcribe " + request.headers.get("x-vercel-id") || "local");

  const { data, success } = schema.safeParse(await request.formData());
  if (!success) return new Response("Invalid request", { status: 400 });

  const transcript = await getTranscript(data.input);
  if (!transcript) return new Response("Invalid audio", { status: 400 });

  console.timeEnd(
    "transcribe " + request.headers.get("x-vercel-id") || "local"
  );
  console.time(
    "text completion " + request.headers.get("x-vercel-id") || "local"
  );

  const completion = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    messages: [
      {
        role: "system",
        content: `- You are Jason, a friendly and helpful voice assistant for Lee County Utilities (LCU).
			- Respond briefly and professionally to customer service requests related to water, wastewater, and reclaimed water services.
			- Provide information on billing, payment options, service connections, rates, and general policies as outlined in the manual.
			- Explain LCU's service area, office locations, and contact information when relevant.
			- Describe account setup requirements, including deposits and application processes.
			- Outline basic information on water conservation, usage monitoring, and leak detection.
			- Explain LCU's policies on service disconnection, reconnection, and bill disputes.
			- Provide high-level information on new construction and development processes related to utilities.
			- Do not quote specific rates or fees, as these may change. Instead, direct customers to the current BOCC approved Rate Resolution.
			- For detailed technical questions or account-specific issues, advise customers to contact LCU directly.
			- If you don't understand a request, politely ask for clarification.
			- Do not provide real-time data or perform actions beyond responding to inquiries.
			- Respond in plain text suitable for text-to-speech, without formatting or emojis.
			- User location is ${location()}.
			- The current time is ${time()}.
			- You are powered by Llama 3 (8B) from Meta, hosted on Groq, with Sonic TTS by Cartesia.
			- You are built with Next.js and hosted on Vercel.`,
      },
      ...data.message,
      {
        role: "user",
        content: transcript,
      },
    ],
  });

  const response = completion.choices[0].message.content;
  console.timeEnd(
    "text completion " + request.headers.get("x-vercel-id") || "local"
  );

  console.time(
    "cartesia request " + request.headers.get("x-vercel-id") || "local"
  );

  const voice = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "Cartesia-Version": "2024-06-30",
      "Content-Type": "application/json",
      "X-API-Key": process.env.CARTESIA_API_KEY!,
    },
    body: JSON.stringify({
      model_id: "sonic-english",
      transcript: response,
      voice: {
        mode: "embedding",
        embedding,
      },
      output_format: {
        container: "raw",
        encoding: "pcm_f32le",
        sample_rate: 24000,
      },
    }),
  });

  console.timeEnd(
    "cartesia request " + request.headers.get("x-vercel-id") || "local"
  );

  if (!voice.ok) {
    console.error(await voice.text());
    return new Response("Voice synthesis failed", { status: 500 });
  }

  console.time("stream " + request.headers.get("x-vercel-id") || "local");
  after(() => {
    console.timeEnd("stream " + request.headers.get("x-vercel-id") || "local");
  });

  return new Response(voice.body, {
    headers: {
      "X-Transcript": encodeURIComponent(transcript),
      "X-Response": encodeURIComponent(response),
    },
  });
}

function location() {
  const headersList = headers();

  const country = headersList.get("x-vercel-ip-country");
  const region = headersList.get("x-vercel-ip-country-region");
  const city = headersList.get("x-vercel-ip-city");

  if (!country || !region || !city) return "unknown";

  return `${city}, ${region}, ${country}`;
}

function time() {
  return new Date().toLocaleString("en-US", {
    timeZone: headers().get("x-vercel-ip-timezone") || undefined,
  });
}

async function getTranscript(input: string | File) {
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

// This is the embedding for the voice we're using
// Cartesia doesn't cache the voice ID, so providing the embedding is quicker
const embedding = [
  0.028491372, -0.1391638, -0.115689054, 0.014934053, 0.031380747, 0.032840155,
  -0.13981827, -0.110673204, 0.03666089, 0.020444114, -0.0098732505,
  -0.000047919486, -0.027173962, -0.1384901, 0.022342375, -0.015293258,
  0.039458044, -0.038734823, -0.03641128, 0.02560386, 0.04175228, 0.04053904,
  -0.09689661, 0.049731854, -0.043193243, -0.033240672, 0.029257176,
  0.006319825, -0.046594825, -0.06826011, -0.06279957, 0.08607602, -0.14586939,
  0.15763284, 0.1435775, -0.012875012, 0.15013453, -0.095192775, -0.084795915,
  0.021333126, 0.118830785, 0.03697425, -0.06727533, -0.034030415, 0.086969115,
  -0.14228137, -0.0029569226, -0.035011604, -0.060441177, -0.003498052,
  0.04654444, 0.021769566, 0.066677414, 0.023351913, -0.029204022, -0.033712972,
  0.09552891, -0.030530509, 0.19085395, 0.07190502, -0.03928957, -0.15640728,
  -0.019417219, 0.05686844, -0.0364809, -0.12735741, 0.098057866, -0.034268208,
  0.026743805, -0.029582117, -0.07457926, 0.10608794, 0.022039559, -0.011393202,
  -0.026265213, -0.08031903, -0.1440034, 0.09673453, 0.054594047, 0.002669445,
  0.0033345232, 0.009314972, -0.1443995, 0.11834314, -0.12666178, -0.113075584,
  -0.11439861, 0.007842917, 0.047062688, 0.08192675, 0.101306245, -0.022347892,
  -0.045984715, -0.032215152, -0.083271995, -0.0389151, 0.053191308,
  -0.048629716, 0.05291833, 0.11321043, 0.019934122, 0.04242131, -0.04702718,
  0.05472134, 0.0037030247, 0.033969734, 0.041244056, -0.07488608, 0.051269654,
  0.00040629698, 0.023166113, 0.09475082, -0.036998134, -0.057446104,
  -0.18413536, 0.0007626198, 0.0053934916, 0.013763193, -0.07379074,
  0.013177856, 0.09163241, 0.0028229496, 0.02326876, -0.076565966, 0.0005429262,
  -0.018847227, -0.085090205, -0.13184647, -0.0145582035, -0.06878027,
  -0.019886322, -0.010282109, 0.026955104, 0.034066472, 0.053368922, 0.10024289,
  0.1092495, -0.011000435, -0.17337179, -0.08550435, 0.03365507, -0.029914645,
  -0.065959826, -0.05280391, 0.05858872, 0.035207685, -0.0018503272,
  -0.037308946, 0.04193502, 0.03442309, 0.07527269, 0.005446172, -0.021133725,
  -0.011251428, -0.015058635, 0.015856266, -0.053730056, 0.042547293,
  -0.017108614, -0.012849737, 0.011148464, 0.06922335, 0.058953118, 0.09268027,
  0.04320933, 0.000595642, 0.028268352, 0.053375594, 0.08590455, 0.06273071,
  0.14364797, 0.12060001, 0.024742233, -0.03915045, -0.08283723, -0.03954623,
  0.032926064, -0.022450564, 0.03212572, -0.07087819, -0.107691385,
  -0.034049273, -0.0062783766, -0.0090122605, -0.09306727, 0.0014946258,
  -0.0002146328, -0.03745981, 0.011419688, -0.07650551, -0.11179312,
  -0.03491727,
];
