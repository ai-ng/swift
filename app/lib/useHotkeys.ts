import { useCallback, useEffect } from "react";

type HotkeyOptions = {
	enter?: () => void;
	escape?: () => void;
	blankDown?: () => void;
	blankUp?: () => void;
};

export function useHotkeys(options: HotkeyOptions) {
	const handleButtonDown = useCallback(
		(e: Event) => {
			const blankPress = isBlankPress(e);

			if (e instanceof KeyboardEvent) {
				if (e.repeat) return;

				if (e.key === "Enter" && blankPress) {
					e.preventDefault();
					return options.enter?.();
				}

				if (e.key === "Escape") {
					e.preventDefault();
					return options.escape?.();
				}

				if (e.key === " " && blankPress) {
					e.preventDefault();
					return options.blankDown?.();
				}

				return;
			}

			if (blankPress) {
				e.preventDefault();
				options.blankDown?.();
			}
		},
		[options]
	);

	const handleButtonUp = useCallback(
		(e: Event) => {
			const blankPress = isBlankPress(e);

			if (e instanceof KeyboardEvent) {
				if (e.key === " " && blankPress) {
					e.preventDefault();
					return options.blankUp?.();
				}

				return;
			}

			if (blankPress) {
				e.preventDefault();
				options.blankUp?.();
			}
		},
		[options]
	);

	useEffect(() => {
		const listeners = {
			keydown: handleButtonDown,
			keyup: handleButtonUp,
			touchstart: handleButtonDown,
			touchend: handleButtonUp,
			mousedown: handleButtonDown,
			mouseup: handleButtonUp,
		};

		for (const [event, listener] of Object.entries(listeners)) {
			window.addEventListener(event, listener);
		}

		return () => {
			for (const [event, listener] of Object.entries(listeners)) {
				window.removeEventListener(event, listener);
			}
		};
	}, [handleButtonDown, handleButtonUp]);
}

// A "blank press" is a click or touch on the background of the page.
// This is so that users can hold anywhere on the page to start recording.
function isBlankPress(e: Event) {
	if (e.target === document.body) return true;
	if (e.target instanceof HTMLElement) return e.target.tagName === "MAIN";
	return false;
}
