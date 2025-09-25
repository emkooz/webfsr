import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { type ObsBroadcastPayload, useOBS } from "~/lib/useOBS";

type ObsPayload = ObsBroadcastPayload & {
	eventType?: string;
};

function getQueryPassword() {
	const params = new URLSearchParams(window.location.search);
	return params.get("pwd") || "";
}

function SensorsObsDemo() {
	const pwd = getQueryPassword();
	const { connect, addCustomEventListener, isConnected, isConnecting } = useOBS();
	const [lastValues, setLastValues] = useState<number[]>([]);

	useEffect(() => {
		if (!pwd) return;
		void connect(pwd);
	}, [pwd]);

	useEffect(() => {
		const unmount = addCustomEventListener((eventData) => {
			try {
				const payload = (eventData || {}) as ObsPayload;
				setLastValues(Array.isArray(payload.values) ? payload.values : []);
			} catch {
				setLastValues([]);
			}
		});
		return unmount;
	}, [addCustomEventListener]);
	return (
		<div className="min-h-screen w-screen flex items-center justify-center bg-transparent">
			<div className="px-4 py-3 rounded-lg border bg-white/70 text-gray-900 shadow-sm">
				<h1 className="text-lg font-semibold">OBS Sensors</h1>
				<p className="text-sm text-gray-700">
					Status: {isConnecting ? "Connecting…" : isConnected ? "Connected" : "Disconnected"}
				</p>
				<p className="text-sm mt-1">Last values length: {lastValues[0] ?? 0}</p>
			</div>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: root will always exist in our entry HTML
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<SensorsObsDemo />
	</StrictMode>,
);
