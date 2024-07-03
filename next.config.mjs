import fs from "node:fs/promises";
import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		after: true,
	},
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "Cross-Origin-Opener-Policy",
						value: "same-origin",
					},
					{
						key: "Cross-Origin-Embedder-Policy",
						value: "require-corp",
					},
				],
			},
		];
	},
};

export default nextConfig;

async function copyFiles() {
	try {
		await fs.access("public/");
	} catch {
		await fs.mkdir("public/", { recursive: true });
	}

	const wasmFiles = (
		await fs.readdir("node_modules/onnxruntime-web/dist/")
	).filter((file) => path.extname(file) === ".wasm");

	await Promise.all([
		fs.copyFile(
			"node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js",
			"public/vad.worklet.bundle.min.js"
		),
		fs.copyFile(
			"node_modules/@ricky0123/vad-web/dist/silero_vad.onnx",
			"public/silero_vad.onnx"
		),
		...wasmFiles.map((file) =>
			fs.copyFile(
				`node_modules/onnxruntime-web/dist/${file}`,
				`public/${file}`
			)
		),
	]);
}

copyFiles();
