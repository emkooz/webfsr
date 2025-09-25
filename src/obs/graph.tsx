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

function GraphObsDemo() {
	const pwd = getQueryPassword();
	const { connect, addCustomEventListener, isConnected, isConnecting, error } = useOBS();
	const [receivedCount, setReceivedCount] = useState(0);
	const [lastPayload, setLastPayload] = useState<ObsPayload | null>(null);

	useEffect(() => {
		if (!pwd) return;
		void connect(pwd);
	}, [pwd]);

	useEffect(() => {
		const unmount = addCustomEventListener((eventData) => {
			try {
				const payload = (eventData || {}) as ObsPayload;
				setLastPayload({
					values: Array.isArray(payload.values) ? payload.values : [],
					thresholds: Array.isArray(payload.thresholds) ? payload.thresholds : [],
				});
				setReceivedCount((c) => c + 1);
			} catch {
				// ignore
			}
		});
		return unmount;
	}, [addCustomEventListener]);

	return (
		<div className="min-h-screen w-screen flex items-center justify-center bg-transparent">
			<div className="px-4 py-3 rounded-lg border bg-white/70 text-gray-900 shadow-sm">
				<h1 className="text-lg font-semibold">OBS Graph</h1>
				<p className="text-sm text-gray-700">
					Status: {isConnecting ? "Connecting…" : isConnected ? "Connected" : "Disconnected"}
				</p>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<p className="text-sm mt-1">Received updates: {receivedCount}</p>
				{lastPayload && (
					<div className="text-xs mt-1 text-gray-800">
						<div>values: {lastPayload.values?.length ?? 0}</div>
						<div>thresholds: {lastPayload.thresholds?.length ?? 0}</div>
					</div>
				)}
			</div>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: root will always exist in our entry HTML
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<GraphObsDemo />
	</StrictMode>,
);
