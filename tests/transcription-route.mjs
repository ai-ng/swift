import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import { z } from "zod";
import { zfd } from "zod-form-data";

test("actual API route preserves default and typed paths and dispatches 60db", async () => {
	let groqTranscriptions = 0;
	let sixtydbTranscriptions = 0;
	let failProvider = false;
	const environment = {};
	class Groq {
		audio = { transcriptions: { create: async () => { groqTranscriptions++; return { text: "Groq transcript" }; } } };
		chat = { completions: { create: async () => ({ choices: [{ message: { content: "Assistant response" } }] }) } };
	}
	const context = createContext({ Request, Response, File, FormData, AbortController, DOMException,
		setTimeout, clearTimeout, process: { env: environment }, console: { time() {}, timeEnd() {}, error() {} },
		fetch: async (url) => {
			if (url === "https://api.60db.ai/stt") {
				sixtydbTranscriptions++;
				return failProvider ? new Response("private error", { status: 402 }) : Response.json({ text: "60db transcript" });
			}
			assert.equal(url, "https://api.cartesia.ai/tts/bytes");
			return new Response(new Uint8Array([0, 0, 0, 0]));
		},
	});
	const synthetic = (exports) => new SyntheticModule(Object.keys(exports), function() {
		for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
	}, { context });
	const helper = new SourceTextModule(stripTypeScriptTypes(await readFile(new URL("../app/lib/sixtydb-stt.ts", import.meta.url), "utf8")), { context });
	const route = new SourceTextModule(stripTypeScriptTypes(await readFile(new URL("../app/api/route.ts", import.meta.url), "utf8")), { context });
	await route.link((name) => ({
		"groq-sdk": synthetic({ default: Groq }),
		"next/headers": synthetic({ headers: async () => new Headers() }),
		"next/server": synthetic({ after: (fn) => fn() }),
		"zod": synthetic({ z }), "zod-form-data": synthetic({ zfd }),
		"../lib/sixtydb-stt": helper,
	}[name]));
	await route.evaluate();
	const send = async (input) => {
		const form = new FormData();
		form.append("input", input);
		return route.namespace.POST(new Request("http://localhost/api", { method: "POST", body: form }));
	};
	const file = new File(["fixture"], "audio.wav", { type: "audio/wav" });
	let response = await send(file);
	assert.equal(response.status, 200);
	assert.equal(decodeURIComponent(response.headers.get("X-Transcript")), "Groq transcript");
	assert.equal(groqTranscriptions, 1);
	environment.STT_PROVIDER = "60db";
	environment.SIXTYDB_API_KEY = "test-secret";
	response = await send(file);
	assert.equal(response.status, 200);
	assert.equal(decodeURIComponent(response.headers.get("X-Transcript")), "60db transcript");
	assert.equal(sixtydbTranscriptions, 1);
	response = await send("typed input");
	assert.equal(decodeURIComponent(response.headers.get("X-Transcript")), "typed input");
	assert.equal(sixtydbTranscriptions, 1);
	failProvider = true;
	response = await send(file);
	assert.equal(response.status, 400);
	assert.equal(await response.text(), "Invalid audio");
	assert.equal(groqTranscriptions, 1);
});
