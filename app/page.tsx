"use client";

import clsx from "clsx";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EnterIcon, LoadingIcon, UserIcon } from "@/lib/icons";
import { usePlayer } from "@/lib/usePlayer";
import { track } from "@vercel/analytics";
import { useMicVAD, utils } from "@ricky0123/vad-react";
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa';

type Message = {
	role: "user" | "assistant";
	content: string;
	latency?: number;
};

// Make sure the Home component is properly exported
export default function Home() {
	const [input, setInput] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const player = usePlayer();
	const messagesEndRef = useRef<HTMLDivElement | null>(null);

	const vad = useMicVAD({
		startOnLoad: true,
		onSpeechEnd: (audio) => {
			player.stop();
			const wav = utils.encodeWAV(audio);
			const blob = new Blob([wav], { type: "audio/wav" });
			submit(blob);
			const isFirefox = navigator.userAgent.includes("Firefox");
			if (isFirefox) vad.pause();
		},
		workletURL: "/vad.worklet.bundle.min.js",
		modelURL: "/silero_vad.onnx",
		positiveSpeechThreshold: 0.6,
		minSpeechFrames: 4,
		ortConfig(ort) {
			const isSafari = /^((?!chrome|android).)*safari/i.test(
				navigator.userAgent
			);

			ort.env.wasm = {
				wasmPaths: {
					"ort-wasm-simd-threaded.wasm":
						"/ort-wasm-simd-threaded.wasm",
					"ort-wasm-simd.wasm": "/ort-wasm-simd.wasm",
					"ort-wasm.wasm": "/ort-wasm.wasm",
					"ort-wasm-threaded.wasm": "/ort-wasm-threaded.wasm",
				},
				numThreads: isSafari ? 1 : 4,
			};
		},
	});

	const [isAudioInputEnabled, setIsAudioInputEnabled] = useState(true);

	useEffect(() => {
		function keyDown(e: KeyboardEvent) {
			if (e.key === "Enter") return inputRef.current?.focus();
			if (e.key === "Escape") return setInput("");
		}

		window.addEventListener("keydown", keyDown);
		return () => window.removeEventListener("keydown", keyDown);
	}, []);

	const toggleAudioInput = () => {
		if (isAudioInputEnabled) {
			vad.pause();
		} else {
			vad.start();
		}
		setIsAudioInputEnabled(!isAudioInputEnabled);
	};

	const [messages, submit, isPending] = useActionState<
		Array<Message>,
		string | Blob
	>(async (prevMessages, data) => {
		const formData = new FormData();

		if (typeof data === "string") {
			formData.append("input", data);
			track("Text input");
		} else {
			formData.append("input", data, "audio.wav");
			track("Speech input");
		}

		for (const message of prevMessages) {
			formData.append("message", JSON.stringify(message));
		}

		const submittedAt = Date.now();

		const response = await fetch("/api", {
			method: "POST",
			body: formData,
		});

		const transcript = decodeURIComponent(
			response.headers.get("X-Transcript") || ""
		);
		const text = decodeURIComponent(
			response.headers.get("X-Response") || ""
		);

		if (!response.ok || !transcript || !text || !response.body) {
			if (response.status === 429) {
				toast.error("Too many requests. Please try again later.");
			} else {
				toast.error((await response.text()) || "An error occurred.");
			}

			return prevMessages;
		}

		const latency = Date.now() - submittedAt;
		player.play(response.body, () => {
			const isFirefox = navigator.userAgent.includes("Firefox");
			if (isFirefox) vad.start();
		});
		setInput(transcript);

		return [
			...prevMessages,
			{
				role: "user",
				content: transcript,
			},
			{
				role: "assistant",
				content: text,
				latency,
			},
		];
	}, []);

	useEffect(() => {
		// Auto-scroll to the latest message
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		submit(input);
	}

	return (
		<>
			<div className="pb-4 min-h-28" />

			{/* Chat Messages Container */}
			<div className="w-full max-w-3xl mx-auto mb-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 shadow-lg overflow-y-auto max-h-[calc(100vh-200px)]">
				{messages.length > 0 ? (
					messages.map((message, index) => (
						<div
							key={index}
							className={clsx(
								"mb-4 p-3 rounded-lg",
								message.role === "user"
									? "bg-blue-500 text-white ml-auto max-w-[80%]"
									: "bg-neutral-200 dark:bg-neutral-700 max-w-[80%]"
							)}
						>
							{message.role === "user" && (
								<div className="flex items-center mb-2">
									<UserIcon className="w-6 h-6 mr-2" />
									<span className="font-semibold">You</span>
								</div>
							)}
							<p className="text-base">{message.content}</p>
							{message.latency && (
								<span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
									{message.latency}ms
								</span>
							)}
						</div>
					))
				) : (
					<div className="text-center text-gray-500 dark:text-gray-400">
						{vad.loading ? (
							<p>Loading speech detection...</p>
						) : vad.errored ? (
							<p>Failed to load speech detection.</p>
						) : (
							<p>Start talking to chat.</p>
						)}
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Input Form */}
			<form
				className="rounded-full bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center w-full max-w-3xl border border-transparent hover:border-neutral-300 focus-within:border-neutral-400 dark:hover:border-neutral-700 dark:focus-within:border-neutral-600"
				onSubmit={handleFormSubmit}
			>
				<input
					type="text"
					className="bg-transparent focus:outline-none p-4 flex-1 placeholder:text-neutral-600 dark:placeholder:text-neutral-400"
					required
					placeholder="Ask me anything"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					ref={inputRef}
				/>

				<button
					type="submit"
					className="p-4 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
					disabled={isPending}
					aria-label="Submit"
				>
					{isPending ? <LoadingIcon /> : <EnterIcon />}
				</button>

				<button
					className="p-2 ml-2 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
					onClick={toggleAudioInput}
					aria-label={isAudioInputEnabled ? "Disable Audio Input" : "Enable Audio Input"}
				>
					{isAudioInputEnabled ? <FaMicrophone size={18} /> : <FaMicrophoneSlash size={18} />}
				</button>
			</form>

			{/* Initial Message */}
			<div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
				<p>
					A fast, open-source voice assistant powered by{" "}
					<A href="https://groq.com">Groq</A>,{" "}
					<A href="https://cartesia.ai">Cartesia</A>,{" "}
					<A href="https://www.vad.ricky0123.com/">VAD</A>, and{" "}
					<A href="https://vercel.com">Vercel</A>.{" "}
					<A href="https://github.com/ai-ng/swift">Learn more</A>.
				</p>
			</div>

			{/* Background Blur Effect */}
			<div
				className={clsx(
					"absolute size-36 blur-3xl rounded-full bg-gradient-to-b from-red-200 to-red-400 dark:from-red-600 dark:to-red-800 -z-50 transition ease-in-out",
					{
						"opacity-0": vad.loading || vad.errored,
						"opacity-30":
							!vad.loading && !vad.errored && !vad.userSpeaking,
						"opacity-100 scale-110": vad.userSpeaking,
					}
				)}
			/>
		</>
	);
}

function A(props: any) {
	return (
		<a
			{...props}
			className="text-blue-500 underline"
			target="_blank"
			rel="noopener noreferrer"
		/>
	);
}
