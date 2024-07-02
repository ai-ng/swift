import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
	onRecordingStop?: (blob: Blob, duration: number) => void;
	onUnsupportedMimeType?: () => void;
	onMicrophoneDenied?: () => void;
};

export function useRecorder(options: Options = {}) {
	const [isRecording, setIsRecording] = useState(false);
	const [volume, setVolume] = useState(0);
	const recorder = useRef<MediaRecorder | null>(null);
	const recordingSince = useRef<number | null>(null);
	const chunks = useRef<Array<Blob>>([]);
	const format = useRef<string | null>(null);

	const onDataAvailable = useCallback((e: BlobEvent) => {
		chunks.current.push(e.data);
	}, []);

	const onStop = useCallback(() => {
		if (!format.current) throw new Error("Format is not set");
		const blob = new Blob(chunks.current, {
			type: format.current,
		});

		const duration = Date.now() - recordingSince.current!;
		options.onRecordingStop?.(blob, duration);
		recordingSince.current = null;
		chunks.current = [];
	}, [options]);

	const getRecorder = useCallback(() => {
		navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				format.current = getSupportedMimeType();
				if (!format.current) return options.onUnsupportedMimeType?.();

				recorder.current = new MediaRecorder(stream, {
					mimeType: format.current,
				});
				recorder.current.addEventListener(
					"dataavailable",
					onDataAvailable
				);
				recorder.current.addEventListener("stop", onStop);

				const context = new AudioContext();
				const audioSource = context.createMediaStreamSource(stream);
				const analyser = context.createAnalyser();
				audioSource.connect(analyser);
				const pcmData = new Float32Array(analyser.fftSize);
				function onFrame() {
					analyser.getFloatTimeDomainData(pcmData);
					let sumSquares = 0.0;
					for (const amplitude of pcmData) {
						sumSquares += amplitude * amplitude;
					}
					const volume = Math.sqrt(sumSquares / pcmData.length);
					setVolume(volume);
					window.requestAnimationFrame(onFrame);
				}
				window.requestAnimationFrame(onFrame);
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
		volume,
		startRecording,
		stopRecording,
	};
}

const types = ["audio/webm", "video/mp4", "audio/mpeg", "audio/wav"];
function getSupportedMimeType() {
	return types.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}
