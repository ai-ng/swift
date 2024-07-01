"use client";

import clsx from "clsx";
import React, { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { EnterIcon, LoadingIcon, MicrophoneIcon } from "@/lib/icons";
import { useRecorder } from "@/lib/useRecorder";
import { playPCMStream } from "@/lib/playPCMStream";
import { useHotkeys } from "@/lib/useHotkeys";
import { track } from "@vercel/analytics";

export default function Home() {
	const [isPending, startTransition] = useTransition();
	const { isRecording, startRecording, stopRecording, volume } = useRecorder({
		onUnsupportedMimeType() {
			toast.error("Your browser does not support audio recording.");
			track("Unsupported MIME type");
		},
		onMicrophoneDenied() {
			toast.error("Access to microphone was denied.");
		},
		onRecordingStop(blob, duration) {
			if (duration < 500) {
				toast.info("Hold the button or spacebar to record.");
				return track("Recording too short");
			}

			submit(blob);
		},
	});
	const [input, setInput] = useState("");
	const [latency, setLatency] = useState<number | null>(null);
	const [response, setResponse] = useState<string | null>(null);
	const messages = useRef<Array<object>>([]);
	const inputRef = useRef<HTMLInputElement>(null);

	useHotkeys({
		enter: () => inputRef.current?.focus(),
		escape: () => setInput(""),
		blankDown: startRecording,
		blankUp: stopRecording,
	});

	const submit = useCallback((data: string | Blob) => {
		startTransition(async () => {
			const formData = new FormData();

			if (typeof data === "string") {
				formData.append("input", data);
				track("Text input");
			} else {
				formData.append("input", data, "audio.webm");
				track("Speech input");
			}

			for (const message of messages.current) {
				formData.append("message", JSON.stringify(message));
			}

			const submittedAt = Date.now();

			const response = await fetch("/api", {
				method: "POST",
				body: formData,
			});

			const transcript = response.headers.get("X-Transcript");
			const text = response.headers.get("X-Response");

			if (!response.ok || !transcript || !text || !response.body) {
				const error = (await response.text()) || "An error occurred.";
				toast.error(error);
				return;
			}

			setLatency(Date.now() - submittedAt);
			playPCMStream(response.body);
			setInput(transcript);
			setResponse(text);

			messages.current.push(
				{
					role: "user",
					content: transcript,
				},
				{
					role: "assistant",
					content: text,
				}
			);
		});
	}, []);

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (isRecording) return stopRecording();
		submit(input);
	}

	return (
		<>
			<div className="pb-4 min-h-28" />

			<form
				className="rounded-full bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center w-full max-w-3xl border border-transparent hover:border-neutral-300 focus-within:border-neutral-400 hover:focus-within:border-neutral-400 dark:hover:border-neutral-700 dark:focus-within:border-neutral-600 dark:hover:focus-within:border-neutral-600"
				onSubmit={handleFormSubmit}
			>
				<button
					className="p-3 box-border group"
					type="button"
					onMouseDown={startRecording}
					onMouseUp={stopRecording}
				>
					<div
						className={clsx(
							"rounded-full bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 drop-shadow group-hover:scale-110 group-active:scale-90 transition ease-in-out p-1",
							{
								"text-red-500": isRecording,
							}
						)}
					>
						<MicrophoneIcon />
					</div>
				</button>

				<input
					type="text"
					className="bg-transparent focus:outline-none py-3 w-full placeholder:text-neutral-700 dark:placeholder:text-neutral-300"
					required
					disabled={isRecording || isPending}
					placeholder="Ask me anything"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					ref={inputRef}
				/>

				<button
					type="submit"
					className="p-4 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
					disabled={isPending}
				>
					{isPending ? <LoadingIcon /> : <EnterIcon />}
				</button>
			</form>

			{response ? (
				<p className="text-neutral-400 dark:text-neutral-600 pt-4 text-center max-w-xl text-balance min-h-28">
					{response}
					<span className="text-xs font-mono text-neutral-300 dark:text-neutral-700">
						{" "}
						({latency}ms)
					</span>
				</p>
			) : (
				<div className="text-neutral-400 dark:text-neutral-600 pt-4 text-center max-w-xl text-balance min-h-28">
					<p>
						A fast, open-source voice assistant powered by{" "}
						<A href="https://groq.com">Groq</A>,{" "}
						<A href="https://cartesia.ai">Cartesia</A>, and{" "}
						<A href="https://vercel.com">Vercel</A>.{" "}
						<A href="https://github.com/ai-ng/swift">Learn more</A>.
					</p>

					<p className="[@media(hover:hover)]:hidden pt-4">
						Tap and hold anywhere to speak.
					</p>
				</div>
			)}

			<div
				className="absolute size-36 blur-3xl rounded-full bg-gradient-to-b from-red-200 to-red-400 dark:from-red-600 dark:to-red-800 -z-50 transition-opacity ease-in-out"
				style={{
					opacity: isRecording ? Math.max(volume * 150, 0.4) : 0,
				}}
			/>
		</>
	);
}

function A(props: any) {
	return (
		<a
			{...props}
			className="text-neutral-500 dark:text-neutral-500 hover:underline font-medium"
		/>
	);
}
