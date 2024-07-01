"use client";

import clsx from "clsx";
import React, {
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";
import { ClockIcon, EnterIcon, LoadingIcon, MicrophoneIcon } from "@/app/icons";
import { useRecorder } from "@/app/utils";

export default function Home() {
	const [isPending, startTransition] = useTransition();
	const { isRecording, startRecording, stopRecording } = useRecorder({
		onUnsupportedMimeType() {
			toast.error("Your browser does not support audio recording.");
		},
		onMicrophoneDenied() {
			toast.error("Access to microphone was denied.");
		},
		onRecordingStop(blob, duration) {
			if (duration < 500) {
				return toast.info("Hold the button or spacebar to record.");
			}

			submit(blob);
		},
	});
	const [input, setInput] = useState("");
	const [latency, setLatency] = useState<number | null>(null);
	const messages = useRef<Array<object>>([]);

	const submit = useCallback((data: string | Blob) => {
		startTransition(async () => {
			const formData = new FormData();

			if (typeof data === "string") {
				formData.append("input", data);
			} else {
				formData.append("input", data, "audio.webm");
			}

			for (const message of messages.current) {
				formData.append("message", JSON.stringify(message));
			}

			const submittedAt = Date.now();

			const response = await fetch("/api/audio", {
				method: "POST",
				body: formData,
			});

			const transcript = response.headers.get("X-Transcript");
			const text = response.headers.get("X-Response");

			if (!response.ok || !transcript || !text || !response.body) {
				toast.error("An error occurred."); // TODO: Show error message
				return;
			}

			// TODO: Play audio

			setInput(transcript);
			setLatency(Date.now() - submittedAt);
			toast(text, {
				duration: Math.max(response.text.length * 50, 5000),
			});

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

	const handleButtonDown = useCallback(
		(e: KeyboardEvent | React.MouseEvent | React.TouchEvent) => {
			if (e.target instanceof HTMLInputElement) return;
			if (e instanceof KeyboardEvent && e.key !== " ") return;
			if (e instanceof KeyboardEvent && e.repeat) return;
			e.preventDefault();
			startRecording();
		},
		[startRecording]
	);

	const handleButtonUp = useCallback(
		(e: KeyboardEvent | React.MouseEvent | React.TouchEvent) => {
			if (e.target instanceof HTMLInputElement) return;
			if (e instanceof KeyboardEvent && e.key !== " ") return;
			e.preventDefault();
			stopRecording();
		},
		[stopRecording]
	);

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (isRecording) return stopRecording();
		submit(input);
	}

	useEffect(() => {
		window.addEventListener("keydown", handleButtonDown);
		window.addEventListener("keyup", handleButtonUp);
		return () => {
			window.removeEventListener("keydown", handleButtonDown);
			window.removeEventListener("keyup", handleButtonUp);
		};
	}, [handleButtonDown, handleButtonUp]);

	return (
		<>
			<form
				className="rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center w-full max-w-3xl border border-transparent hover:border-neutral-300 focus-within:border-neutral-400 hover:focus-within:border-neutral-400 dark:hover:border-neutral-700 dark:focus-within:border-neutral-600 dark:hover:focus-within:border-neutral-600"
				onSubmit={handleFormSubmit}
			>
				<button
					className={clsx("p-3 box-border group", {
						"text-red-500": isRecording,
					})}
					onTouchStart={handleButtonDown}
					onTouchEnd={handleButtonUp}
					onMouseDown={handleButtonDown}
					onMouseUp={handleButtonUp}
					type="button"
				>
					<div className="rounded-full bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 drop-shadow group-hover:scale-110 group-active:scale-90 transition ease-in-out p-1">
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
				/>

				<button
					type="submit"
					className="p-4 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
					disabled={isPending}
				>
					{isPending ? <LoadingIcon /> : <EnterIcon />}
				</button>
			</form>

			<p
				className={clsx(
					"text-sm text-neutral-700 dark:text-neutral-300 text-center pt-2 flex items-center gap-1",
					{ invisible: !latency }
				)}
			>
				<ClockIcon /> {latency}ms
			</p>
		</>
	);
}

const types = ["audio/webm", "video/mp4", "audio/mpeg", "audio/wav"];
function getSupportedMimeType() {
	return types.find((type) => MediaRecorder.isTypeSupported(type));
}
