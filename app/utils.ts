import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
	onRecordingStop?: (blob: Blob, duration: number) => void;
	onUnsupportedMimeType?: () => void;
	onMicrophoneDenied?: () => void;
};

export function useRecorder(options: Options = {}) {
	const [isRecording, setIsRecording] = useState(false);
	const recorder = useRef<MediaRecorder | null>(null);
	const recordingSince = useRef<number | null>(null);
	const chunks = useRef<Array<Blob>>([]);

	const onDataAvailable = useCallback((e: BlobEvent) => {
		chunks.current.push(e.data);
	}, []);

	const onStop = useCallback(() => {
		const blob = new Blob(chunks.current, {
			type: "audio/webm",
		});

		const duration = Date.now() - recordingSince.current!;
		options.onRecordingStop?.(blob, duration);
		recordingSince.current = null;
	}, [options]);

	const getRecorder = useCallback(() => {
		navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				const mimeType = getSupportedMimeType();
				if (!mimeType) return options.onUnsupportedMimeType?.();

				recorder.current = new MediaRecorder(stream, {
					mimeType,
				});
				recorder.current.addEventListener(
					"dataavailable",
					onDataAvailable
				);
				recorder.current.addEventListener("stop", onStop);
			})
			.catch(() => options.onMicrophoneDenied?.());
	}, [options, onDataAvailable, onStop]);

	const startRecording = useCallback(() => {
		if (!recorder.current) getRecorder();
		if (!recorder.current) return;
		recorder.current.start();
		setIsRecording(true);
		recordingSince.current = Date.now();
	}, [getRecorder]);

	const stopRecording = useCallback(() => {
		if (!recorder.current) return;
		recorder.current.stop();
		setIsRecording(false);
	}, []);

	useEffect(() => {
		if (!recorder.current) getRecorder();
	}, [getRecorder]);

	return {
		isRecording,
		startRecording,
		stopRecording,
	};
}

const types = ["audio/webm", "video/mp4", "audio/mpeg", "audio/wav"];
function getSupportedMimeType() {
	return types.find((type) => MediaRecorder.isTypeSupported(type));
}
