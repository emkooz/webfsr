import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { useOBS } from "~/lib/useOBS";

function getQueryPassword() {
	const params = new URLSearchParams(window.location.search);
	return params.get("pwd") || "";
}

function HeartrateObsDemo() {
	const pwd = getQueryPassword();
	const { connect, addCustomEventListener, isConnected, isConnecting } = useOBS();
	const [eventCount, setEventCount] = useState(0);

	useEffect(() => {
		if (!pwd) return;
		void connect(pwd);
	}, [pwd]);

	useEffect(() => {
		const unmount = addCustomEventListener((_eventData) => {
			setEventCount((c) => c + 1);
		});
		return unmount;
	}, [addCustomEventListener]);
	return (
		<div className="min-h-screen w-screen flex items-center justify-center bg-transparent">
			<div className="px-4 py-3 rounded-lg border bg-white/70 text-gray-900 shadow-sm">
				<h1 className="text-lg font-semibold">OBS Heartrate</h1>
				<p className="text-sm text-gray-700">Status: {isConnecting ? "Connecting…" : isConnected ? "Connected" : "Disconnected"}</p>
				<p className="text-sm mt-1">Events received: {eventCount}</p>
			</div>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: root will always exist in our entry HTML
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<HeartrateObsDemo />
	</StrictMode>,
);
