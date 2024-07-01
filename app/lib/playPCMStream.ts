export async function playPCMStream(stream: ReadableStream) {
	const audioContext = new AudioContext({ sampleRate: 24000 });

	let nextStartTime = audioContext.currentTime;
	const reader = stream.getReader();
	let leftover = new Uint8Array();
	let result = await reader.read();

	while (!result.done) {
		const data = new Uint8Array(leftover.length + result.value.length);
		data.set(leftover);
		data.set(result.value, leftover.length);

		const length = Math.floor(data.length / 4) * 4;
		const remainder = data.length % 4;
		const buffer = new Float32Array(data.buffer, 0, length / 4);

		leftover = new Uint8Array(data.buffer, length, remainder);

		const audioBuffer = audioContext.createBuffer(
			1,
			buffer.length,
			audioContext.sampleRate
		);
		audioBuffer.copyToChannel(buffer, 0);

		const source = audioContext.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(audioContext.destination);
		source.start(nextStartTime);

		nextStartTime += audioBuffer.duration;

		result = await reader.read();
	}
}
