import { IconCornerDownLeft, IconMicrophone } from "@tabler/icons-react";

export default function Home() {
	return (
		<form className="rounded-full bg-neutral-200 flex items-center w-full max-w-3xl border border-transparent focus-within:border-blue-300">
			<button className="rounded-full bg-white p-1 border border-neutral-300 drop-shadow m-3 hover:scale-110 active:scale-90 transition ease-in-out">
				<IconMicrophone />
			</button>

			<input
				type="text"
				className="bg-transparent focus:outline-none py-3 w-full placeholder:text-neutral-700"
				placeholder="Ask me anything"
			/>

			<button type="submit" className="m-3 text-neutral-700">
				<IconCornerDownLeft />
			</button>
		</form>
	);
}
