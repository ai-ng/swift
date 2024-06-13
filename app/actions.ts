"use server";

import Groq from "groq-sdk";
import { headers } from "next/headers";

const groq = new Groq();

export async function assistant(base64: string) {
	const file = await convertToFile(base64);

	const { text } = await groq.audio.transcriptions.create({
		file,
		model: "whisper-large-v3",
	});

	if (text.trim().length === 0) {
		return { error: "No audio detected." };
	}

	const response = await groq.chat.completions.create({
		model: "llama3-8b-8192",
		messages: [
			{
				role: "system",
				content: `- You are a friendly and helpful voice assistant named Swift.
				- Respond briefly to the user's request, and do not provide unnecessary information.
				- If you don't understand the user's request, you can ask for clarification.
				- If you aren't sure about something, say so.
				${location()}
				- You are based on Meta's Llama 3 model, the 8B version.
				- You are running on Groq Cloud. Groq is an AI infrastructure company that builds fast inference technology.`,
			},
			{
				role: "user",
				content: text,
			},
		],
	});

	return { error: null, text: response.choices[0].message.content };
}

export async function convertToFile(base64: string) {
	const res = await fetch(base64);
	const blob = await res.blob();
	const extension = blob.type.split("/")[1];
	return new File([blob], `audio.${extension}`, { type: blob.type });
}

function location() {
	const headersList = headers();

	const country = headersList.get("x-vercel-ip-country");
	const region = headersList.get("x-vercel-ip-country-region");
	const city = headersList.get("x-vercel-ip-city");

	if (!country || !region || !city) return "- User location is unknown.";

	return `- User is currently in ${city}, ${region}, ${country}.`;
}
