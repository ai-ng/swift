import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
	plugins: [],
	theme: {
		extend: {
			colors: {
				neutral: {
					200: "#F0F0F0",
					300: "#D1D1D1",
				},
			},
		},
	},
};
export default config;
