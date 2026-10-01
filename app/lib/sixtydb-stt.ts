/** Transcribe recorded audio through the 60db REST API. */
export async function transcribeSixtyDB(input: File, signal?: AbortSignal) {
	const key = process.env.SIXTYDB_API_KEY;
	if (!key?.trim()) throw new Error("SIXTYDB_API_KEY is required");
	if (input.size === 0 || input.size > 10 * 1024 * 1024) {
		throw new Error("60db audio must be nonempty and at most 10 MB");
	}
	const form = new FormData();
	form.append("file", input, input.name);
	form.append("language", process.env.SIXTYDB_STT_LANGUAGE || "auto");
	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	if (signal?.aborted) abort();
	else signal?.addEventListener("abort", abort, { once: true });
	const timeout = setTimeout(() => controller.abort(new DOMException("Transcription timed out", "TimeoutError")), 60_000);
	try {
		const response = await fetch("https://api.60db.ai/stt", {
			method: "POST",
			headers: { Authorization: `Bearer ${key}` },
			body: form,
			redirect: "error",
			signal: controller.signal,
		});
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(`60db transcription failed (HTTP ${response.status})`);
		}
		const result: unknown = await response.json();
		if (!result || typeof result !== "object" || !("text" in result)
			|| typeof result.text !== "string" || ("success" in result && result.success === false)) {
			throw new Error("60db returned an invalid transcript");
		}
		return result.text.trim() || null;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abort);
	}
}
