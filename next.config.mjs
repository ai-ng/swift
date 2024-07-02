import fs from "node:fs/promises";
import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		after: true,
	},
};

export default nextConfig;

async function copyFiles() {
	try {
		await fs.access(".next/static/chunks/");
	} catch {
		await fs.mkdir(".next/static/chunks/", { recursive: true });
	}

	const wasmFiles = (
		await fs.readdir("node_modules/onnxruntime-web/dist/")
	).filter((file) => path.extname(file) === ".wasm");

	await Promise.all([
		fs.copyFile(
			"node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js",
			".next/static/chunks/vad.worklet.bundle.min.js"
		),
		fs.copyFile(
			"node_modules/@ricky0123/vad-web/dist/silero_vad.onnx",
			".next/static/chunks/silero_vad.onnx"
		),
		...wasmFiles.map((file) =>
			fs.copyFile(
				`node_modules/onnxruntime-web/dist/${file}`,
				`.next/static/chunks/${file}`
			)
		),
	]);
}

copyFiles();
