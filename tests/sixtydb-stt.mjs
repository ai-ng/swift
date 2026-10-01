import { test } from "node:test";
import assert from "node:assert/strict";
import { transcribeSixtyDB } from "../app/lib/sixtydb-stt.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.SIXTYDB_API_KEY;
const originalLanguage = process.env.SIXTYDB_STT_LANGUAGE;
const audio = new File(["wav-fixture"], "audio.wav", { type: "audio/wav" });

test("60db transcription contract, failures, size validation and cancellation", async () => {
	try {
		process.env.SIXTYDB_API_KEY = "test-secret";
		delete process.env.SIXTYDB_STT_LANGUAGE;
		let captured;
		globalThis.fetch = async (url, options) => {
			captured = { url, options };
			return Response.json({ text: "  Hello world  " });
		};
		assert.equal(await transcribeSixtyDB(audio), "Hello world");
		assert.equal(captured.url, "https://api.60db.ai/stt");
		assert.equal(captured.options.headers.Authorization, "Bearer test-secret");
		assert.equal(captured.options.headers["Content-Type"], undefined);
		assert.equal(captured.options.redirect, "error");
		assert.equal(captured.options.body.get("file").name, "audio.wav");
		assert.equal(await captured.options.body.get("file").text(), "wav-fixture");
		assert.equal(captured.options.body.get("language"), "auto");
		process.env.SIXTYDB_STT_LANGUAGE = "hi";
		await transcribeSixtyDB(audio);
		assert.equal(captured.options.body.get("language"), "hi");
		for (const body of [null, {}, { text: 42 }, { text: "bad", success: false }]) {
			globalThis.fetch = async () => Response.json(body);
			await assert.rejects(transcribeSixtyDB(audio), /invalid transcript/);
		}
		globalThis.fetch = async () => Response.json({ text: " " });
		assert.equal(await transcribeSixtyDB(audio), null);
		globalThis.fetch = async () => new Response("invalid JSON");
		await assert.rejects(transcribeSixtyDB(audio), SyntaxError);
		for (const status of [401, 402, 429, 503]) {
			globalThis.fetch = async () => new Response("private provider error", { status });
			await assert.rejects(transcribeSixtyDB(audio), new RegExp(`HTTP ${status}`));
		}
		let calls = 0;
		globalThis.fetch = async () => { calls++; throw new Error("should not send"); };
		await assert.rejects(transcribeSixtyDB(new File([], "empty.wav")), /nonempty/);
		await assert.rejects(transcribeSixtyDB(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.wav")), /10 MB/);
		delete process.env.SIXTYDB_API_KEY;
		await assert.rejects(transcribeSixtyDB(audio), /SIXTYDB_API_KEY/);
		assert.equal(calls, 0);
		process.env.SIXTYDB_API_KEY = "test-secret";
		const controller = new AbortController();
		controller.abort();
		globalThis.fetch = async (_, options) => options.signal.throwIfAborted();
		await assert.rejects(transcribeSixtyDB(audio, controller.signal), { name: "AbortError" });
	} finally {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) delete process.env.SIXTYDB_API_KEY; else process.env.SIXTYDB_API_KEY = originalKey;
		if (originalLanguage === undefined) delete process.env.SIXTYDB_STT_LANGUAGE; else process.env.SIXTYDB_STT_LANGUAGE = originalLanguage;
	}
});
