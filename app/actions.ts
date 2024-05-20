"use server";

import OpenAI from "openai";

const groq = new OpenAI({
	baseURL: "https://api.groq.com/openai/v1",
	apiKey: process.env.GROQ_API_KEY,
});

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
				content:
					"You are a voice assistant named Swift who is helping a user. Respond briefly to the user's requests.",
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
	return new File([blob], "audio.wav", { type: "audio/wav" });
}
