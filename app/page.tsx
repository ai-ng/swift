// page.tsx

// --- NEW VERSION USING THE WEBPLAYER --- 

/*
Let's implement this in pieces:
1) Implement a button where they can select from a dropdown the language that they want everything translated into, then it updates based on that 
2) Upload a sample of there voice and does the instant voice clone 
3) Then moves to the main screen, i don't think there should even be a search bar
4) Have a two-way communication system, look into ways that this could be 
*/

"use client";

import clsx from "clsx";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EnterIcon, LoadingIcon } from "@/lib/icons";
import { usePlayer } from "@/lib/usePlayer";
import { track } from "@vercel/analytics";
import { useMicVAD, utils } from "@ricky0123/vad-react";
import Cartesia, { WebPlayer } from "@cartesia/cartesia-js";
import { useMemo } from "react";

const languages = [
	{ code: "en", name: "English" },
	{ code: "es", name: "Spanish" },
	{ code: "fr", name: "French" },
	{ code: "de", name: "German" },
	{ code: "hi", name: "Hindi" },
	// Add more languages as needed
  ];

type Message = {
	role: "user" | "assistant";
	content: string;
	latency?: number;
};

export default function Home() {
	const [selectedLanguage, setSelectedLanguage] = useState("en");
	const [input, setInput] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const micPlayer = usePlayer();
	const audioContextRef = useRef<AudioContext | null>(null);
	const [voiceSample, setVoiceSample] = useState<File | null>(null);
	const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// --- ADDING USE MEMO ---

	// const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);  
	// const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);  

	// const [websocket, connectWebsocket] = useMemo(() => {
	// 	const cartesia = new Cartesia({
	// 	  apiKey: process.env.NEXT_PUBLIC_CARTESIA_API_KEY!,
	// 	});
	// const [websocket, connectWebsocket] = useMemo(() => {
	// 	const cartesia = new Cartesia({
	// 	  apiKey: process.env.NEXT_PUBLIC_CARTESIA_API_KEY!,
	// 	});
	  
	// 	const ws = cartesia.tts.websocket({
	// 	  container: "raw",
	// 	  encoding: "pcm_f32le",
	// 	  sampleRate: 44100,
	// 	});
	// 	const ws = cartesia.tts.websocket({
	// 	  container: "raw",
	// 	  encoding: "pcm_f32le",
	// 	  sampleRate: 44100,
	// 	});
	  
	// 	const connect = () => ws.connect();
	// 	const connect = () => ws.connect();
	  
	// 	return [ws, connect];
	//   }, []);
	// 	return [ws, connect];
	//   }, []);
	  
	//   const player = useMemo(() => new WebPlayer({ bufferDuration: 0.1 }), []);
	//   const player = useMemo(() => new WebPlayer({ bufferDuration: 0.1 }), []);

	//   useEffect(() => {
	// 	connectWebsocket().then(() => {
	// 	  setIsWebSocketConnected(true);
	// 	}).catch((error) => {
	// 	  console.error("WebSocket connection failed:", error);
	// 	});
	//   useEffect(() => {
	// 	connectWebsocket().then(() => {
	// 	  setIsWebSocketConnected(true);
	// 	}).catch((error) => {
	// 	  console.error("WebSocket connection failed:", error);
	// 	});
	  
	// 	return () => {
	// 	  websocket.disconnect();
	// 	};
	//   }, [websocket, connectWebsocket]);

	const handleVoiceSampleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		console.log("File input changed");
		if (e.target.files && e.target.files[0]) {
		  const file = e.target.files[0];
		  console.log("File selected:", file.name);
		  setVoiceSample(file);
		  await handleVoiceClone(file);
		}
	  };
	
	  const handleVoiceClone = async (file: File) => {
		if (!file) return;
	  
		const formData = new FormData();
		formData.append('voiceSample', file);
	  
		try {
			const response = await fetch('/api/clone-voice', {
			  method: 'POST',
			  body: formData,
			});
		
			const data = await response.json();
		
			if (response.ok) {
			  if (data.voiceId) {
				setClonedVoiceId(data.voiceId);
				toast.success("Voice cloned and created successfully!");
			  } else {
				console.error("Unexpected response:", data);
				toast.error("Unexpected response from server.");
			  }
			} else {
			  console.error("Error response:", data);
			  toast.error(data.error || "Failed to clone voice. Please try again.");
			}
		  } catch (error) {
			console.error("Error cloning voice:", error);
			toast.error("An error occurred while cloning the voice.");
		  }
		};		

	const vad = useMicVAD({
		startOnLoad: true,
		onSpeechEnd: (audio) => {
			micPlayer.stop();
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
					"ort-wasm-simd-threaded.wasm": "/ort-wasm-simd-threaded.wasm",
					"ort-wasm-simd.wasm": "/ort-wasm-simd.wasm",
					"ort-wasm.wasm": "/ort-wasm.wasm",
					"ort-wasm-threaded.wasm": "/ort-wasm-threaded.wasm",
				},
				numThreads: isSafari ? 1 : 4,
			};
		},
	});

	useEffect(() => {
		function keyDown(e: KeyboardEvent) {
			if (e.key === "Enter") return inputRef.current?.focus();
			if (e.key === "Escape") return setInput("");
		}

		window.addEventListener("keydown", keyDown);
		return () => window.removeEventListener("keydown", keyDown);
	});


	const [messages, submit, isPending] = useActionState<Array<Message>, string | Blob>(
		async (prevMessages, data) => {
			// if (!isWebSocketConnected) {
			// 	toast.error("WebSocket is not connected. Please try again.");
			// 	return prevMessages;
			//   }
			const formData = new FormData();

			if (clonedVoiceId) {
				formData.append("clonedVoiceId", clonedVoiceId);
			}

			if (typeof data === "string") {
				formData.append("input", data);
				track("Text input");
			} else {
				formData.append("input", data, "audio.wav");
				track("Speech input");
			}

			formData.append("language", selectedLanguage);

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

			if (!response.ok || !transcript || !response.body) {
				if (response.status === 429) {
					toast.error("Too many requests. Please try again later.");
				} else {
					toast.error((await response.text()) || "An error occurred.");
				}

				return prevMessages;
			}

			const cartesia = new Cartesia({
				apiKey: process.env.NEXT_PUBLIC_CARTESIA_API_KEY!,
			});

			const websocket = cartesia.tts.websocket({
				container: "raw",
				encoding: "pcm_f32le",
				sampleRate: 44100,
			});

			await websocket.connect();

			if (!audioContextRef.current) {
				audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
				await audioContextRef.current.resume();
			}

			const player = new WebPlayer({bufferDuration: 0.1});

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let fullResponse = "";

			const cartesiaContextId = response.headers.get("X-Cartesia-Context-Id") || ""; // Retrieve context ID
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}
				const chunk = decoder.decode(value);
				fullResponse += chunk;
				console.log("THIS IS A CHUNK?", chunk)
				const cartesiaResponse = await websocket.send({
					model_id: selectedLanguage === "en" ? "sonic-english" : "sonic-multilingual",
					voice: {
						mode: "id",
						id: clonedVoiceId || "79a125e8-cd45-4c13-8a67-188112f4dd22",
					},
					transcript: chunk,
					context_id: cartesiaContextId, 
					continue: true,
					language: selectedLanguage,
				});

				// await player.play(cartesiaResponse.source);
				await player.play(cartesiaResponse.source);

			}

			await websocket.send({
				model_id: "sonic-english",
				voice: {
					mode: "id",
					id: clonedVoiceId || "79a125e8-cd45-4c13-8a67-188112f4dd22",
				},
				transcript: "",
				context_id: cartesiaContextId, 
				continue: false,
			});

			websocket.disconnect();
			websocket.disconnect();

			return [
				...prevMessages,
				{
					role: "user",
					content: transcript,
				},
				{
					role: "assistant",
					content: fullResponse,
					latency: Date.now() - submittedAt,
				},
			];
		},
		[]
	);

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		submit(input);
	}

	return (
		<>
			<div className="pb-4 min-h-28" />

			<div className="mb-4">
				<select
				value={selectedLanguage}
				onChange={(e) => setSelectedLanguage(e.target.value)}
				className="rounded-md bg-neutral-200 dark:bg-neutral-800 p-2"
				>
				{languages.map((lang) => (
					<option key={lang.code} value={lang.code}>
					{lang.name}
					</option>
				))}
				</select>
			</div>

			{/* <div className="mb-4">
				<input
				type="file"
				accept="audio/*"
				onChange={handleVoiceSampleUpload}
				className="hidden"
				ref={fileInputRef}
				/>
				<button
				onClick={() => fileInputRef.current?.click()}
				className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
				>
				Upload Voice Sample
				</button>
				<button
				onClick={handleVoiceClone}
				disabled={!voiceSample}
				className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
				>
				Clone Voice
				</button>
			</div> */}
			
			<div className="mb-4">
				<input
					type="file"
					accept="audio/*"
					ref={fileInputRef}
					onChange={handleVoiceSampleUpload}
					className="block w-full text-sm text-gray-500
					file:mr-4 file:py-2 file:px-4
					file:rounded-full file:border-0
					file:text-sm file:font-semibold
					file:bg-blue-50 file:text-blue-700
					hover:file:bg-blue-100"
				/>
				{clonedVoiceId && (
					<span className="mt-2 text-green-500 block">Voice cloned successfully!</span>
				)}
			</div>

			<form
				className="rounded-full bg-neutral-200/80 dark:bg-neutral-800/80 flex items-center w-full max-w-3xl border border-transparent hover:border-neutral-300 focus-within:border-neutral-400 hover:focus-within:border-neutral-400 dark:hover:border-neutral-700 dark:focus-within:border-neutral-600 dark:hover:focus-within:border-neutral-600"
				onSubmit={handleFormSubmit}
			>
				<input
					type="text"
					className="bg-transparent focus:outline-none p-4 w-full placeholder:text-neutral-600 dark:placeholder:text-neutral-400"
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

			</form>

			<div className="text-neutral-400 dark:text-neutral-600 pt-4 text-center max-w-xl text-balance min-h-28 space-y-4">
				{messages.length > 0 && (
					<p>
						{messages.at(-1)?.content}
						<span className="text-xs font-mono text-neutral-300 dark:text-neutral-700">
							{" "}
							({messages.at(-1)?.latency}ms)
						</span>
					</p>
				)}

				{messages.length === 0 && (
					<>
						<p>
							PhonePal, real-time translation of voice calls powered by{" "}
							<A href="https://groq.com">Groq</A>,{" "}
							<A href="https://cartesia.ai">Cartesia</A>,{" "}
							<A href="https://www.vad.ricky0123.com/">VAD</A>,
							and <A href="https://vercel.com">Vercel</A>.{" "}
							<A
								href="https://github.com/ai-ng/swift"
								target="_blank"
							>
								Learn more
							</A>
							.
						</p>

						{vad.loading ? (
							<p>Loading speech detection...</p>
						) : vad.errored ? (
							<p>Failed to load speech detection.</p>
						) : (
							<p>Start talking to chat.</p>
						)}
					</>
				)}
			</div>

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
			className="text-neutral-500 dark:text-neutral-500 hover:underline font-medium"
		/>
	);
}
