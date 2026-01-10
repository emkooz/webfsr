import { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Store the deferred prompt event globally so it persists across component re-mounts
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

const notifyListeners = () => {
	listeners.forEach((listener) => listener());
};

// Initialize event listener immediately (not in useEffect) to catch early events
if (typeof window !== "undefined") {
	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
		notifyListeners();
	});

	window.addEventListener("appinstalled", () => {
		deferredPrompt = null;
		notifyListeners();
	});
}

function subscribe(callback: () => void) {
	listeners.add(callback);
	return () => listeners.delete(callback);
}

function getSnapshot() {
	return deferredPrompt;
}

function getServerSnapshot() {
	return null;
}

// Detect iOS (Safari on iOS doesn't support beforeinstallprompt)
export function isIOS(): boolean {
	if (typeof window === "undefined") return false;
	return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// Detect if running in standalone mode (already installed)
export function isStandalone(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

// Detect Android
export function isAndroid(): boolean {
	if (typeof window === "undefined") return false;
	return /Android/i.test(navigator.userAgent);
}

export function usePWAInstall() {
	const prompt = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
	const [isInstalled, setIsInstalled] = useState(() => isStandalone());

	useEffect(() => {
		// Check standalone mode on mount and when display mode changes
		const mql = window.matchMedia("(display-mode: standalone)");
		const handleChange = () => setIsInstalled(mql.matches);
		mql.addEventListener("change", handleChange);
		return () => mql.removeEventListener("change", handleChange);
	}, []);

	const canInstall = !isInstalled && prompt !== null;
	const showIOSInstall = !isInstalled && isIOS() && !prompt;

	const install = async (): Promise<boolean> => {
		if (!prompt) return false;

		try {
			await prompt.prompt();
			const choice = await prompt.userChoice;

			if (choice.outcome === "accepted") {
				deferredPrompt = null;
				notifyListeners();
				return true;
			}
		} catch (error) {
			console.error("PWA install error:", error);
		}

		return false;
	};

	return {
		canInstall,
		showIOSInstall,
		isInstalled,
		install,
		isIOS: isIOS(),
		isAndroid: isAndroid(),
	};
}
