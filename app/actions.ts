"use server";

import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";

const groq = new Groq();

const MessagesSchema = z.array(
	z.object({
		role: z.enum(["user", "assistant"]),
		content: z.string(),
	})
);

export type Messages = z.infer<typeof MessagesSchema>;

type ErrorResult = {
	error: string;
};

type SuccessResult = {
	transcription: string;
	text: string;
};

type AssistantResult = ErrorResult | SuccessResult;

export async function assistant({
	data,
	prevMessages,
}: {
	data: string | FormData;
	prevMessages: Messages;
}): Promise<AssistantResult> {
	const text = await getText(data);

	if (text.trim().length === 0) {
		return { error: "No audio detected." };
	}

	const { success } = MessagesSchema.safeParse(prevMessages);
	if (!success) {
		return { error: "Invalid messages." };
	}

	const time = new Date().toLocaleString("en-US", {
		timeZone: headers().get("x-vercel-ip-timezone") || undefined,
	});

	const response = await groq.chat.completions.create({
		model: "llama3-8b-8192",
		messages: [
			{
				role: "system",
				content: `- You are Swift, a friendly and helpful voice assistant.
			- Respond briefly to the user's request, and do not provide unnecessary information.
			- If you don't understand the user's request, ask for clarification.
			- You do not have access to up-to-date information, so you should not provide real-time data.
			- You are not capable of performing actions other than responding to the user.
			- Do not use markdown, emojis, or other formatting in your responses. Respond in a way easily spoken by text-to-speech software.
			- User location is ${location()}.
			- The current time is ${time}.
			- Your large language model is Llama 3, created by Meta, the 8 billion parameter version. It is hosted on Groq, an AI infrastructure company that builds fast inference technology.
			- Your text-to-speech model is Sonic, created and hosted by Cartesia, a company that builds fast and realistic speech synthesis technology.
			- You are built with Next.js and hosted on Vercel.`,
			},
			...prevMessages,
			{
				role: "user",
				content: text,
			},
		],
	});

	return {
		transcription: text,
		text: response.choices[0].message.content,
	};
}

function location() {
	const headersList = headers();

	const country = headersList.get("x-vercel-ip-country");
	const region = headersList.get("x-vercel-ip-country-region");
	const city = headersList.get("x-vercel-ip-city");

	if (!country || !region || !city) return "unknown";

	return `${city}, ${region}, ${country}`;
}

async function getText(data: string | FormData) {
	if (typeof data === "string") return data;

	const blob = data.get("audio") as Blob | null;
	if (!blob) return "";
	const extension = blob.type.split("/")[1];
	const file = new File([blob], `audio.${extension}`, { type: blob.type });

	try {
		const { text } = await groq.audio.transcriptions.create({
			file,
			model: "whisper-large-v3",
		});
		return text.trim();
	} catch {
		return ""; // Empty audio file
	}
}
