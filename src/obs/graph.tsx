import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import TimeSeriesGraph from "~/components/TimeSeriesGraph";
import { type ObsBroadcastPayload, useOBS } from "~/lib/useOBS";

type ObsPayload = ObsBroadcastPayload & {
	eventType?: string;
};

// Default configuration values
const DEFAULT_CONFIG = {
	timeWindow: 10000,
	sensorColors: ["#3a7da3", "#d4607c", "#8670d4", "#d49b20", "#459ea0", "#d45478"],
	thresholdLineOpacity: 0.7,
	showGridLines: true,
	showThresholdLines: true,
	showLegend: false,
	showBorder: false,
	showActivation: true,
	activationColor: "#4dd253",
	sensorLabelColor: "rgba(255, 255, 255, 0.9)",
};

function getQueryPassword() {
	const params = new URLSearchParams(window.location.search);
	return params.get("pwd") || "";
}

function parseQueryConfig() {
	const params = new URLSearchParams(window.location.search);

	return {
		timeWindow: Number(params.get("window")) || DEFAULT_CONFIG.timeWindow,
		sensorColors: params.get("colors")?.split(",") || [...DEFAULT_CONFIG.sensorColors],
		thresholdLineOpacity: Number(params.get("thresholdOpacity")) || DEFAULT_CONFIG.thresholdLineOpacity,
		showGridLines: params.get("grid") !== "false" ? DEFAULT_CONFIG.showGridLines : false,
		showThresholdLines: params.get("thresholds") !== "false" ? DEFAULT_CONFIG.showThresholdLines : false,
		showLegend: params.get("legend") === "true" ? true : DEFAULT_CONFIG.showLegend,
		showBorder: params.get("border") === "true" ? true : DEFAULT_CONFIG.showBorder,
		showActivation: params.get("activation") !== "false" ? DEFAULT_CONFIG.showActivation : false,
		activationColor: params.get("activationColor") || DEFAULT_CONFIG.activationColor,
		sensorLabelColor: params.get("labelColor") || DEFAULT_CONFIG.sensorLabelColor,
	};
}

function GraphOBSComponent() {
	const pwd = getQueryPassword();
	const config = parseQueryConfig();
	const { connect, addCustomEventListener, isConnected, isConnecting, error } = useOBS();
	const [latestData, setLatestData] = useState<{ values: number[] } | null>(null);
	const [thresholds, setThresholds] = useState<number[]>([]);
	const [sensorLabels, setSensorLabels] = useState<string[]>([]);

	useEffect(() => {
		if (!pwd) return;
		void connect(pwd);
	}, [pwd]);

	useEffect(() => {
		const unmount = addCustomEventListener((eventData) => {
			try {
				const payload = (eventData || {}) as ObsPayload;

				if (payload.values && Array.isArray(payload.values)) {
					setLatestData({ values: payload.values });
				}

				if (payload.thresholds && Array.isArray(payload.thresholds)) {
					setThresholds(payload.thresholds);
				}

				// Generate default sensor labels if we don't have them
				if (sensorLabels.length === 0 && payload.values) {
					setSensorLabels(payload.values.map((_, i) => `Sensor ${i + 1}`));
				}
			} catch {
				// ignore
			}
		});
		return unmount;
	}, [addCustomEventListener, sensorLabels.length]);

	// Show connection status if not connected
	if (!isConnected && !isConnecting) {
		return (
			<div className="w-full h-screen flex items-center justify-center bg-transparent">
				<div className="px-6 py-4 rounded-lg border bg-white/70 text-gray-900 shadow-sm">
					<h1 className="text-lg font-semibold">WebFSR OBS Graph</h1>
					<p className="text-sm text-gray-700">
						Status: {isConnecting ? "Connecting…" : isConnected ? "Connected" : "Disconnected"}
					</p>
					{error && <p className="text-sm text-red-600">{error}</p>}
					{!pwd && <p className="text-sm text-amber-600">No password provided in URL</p>}
				</div>
			</div>
		);
	}

	return (
		<div className="w-full h-screen bg-transparent">
			<TimeSeriesGraph
				latestData={latestData}
				timeWindow={config.timeWindow}
				thresholds={thresholds}
				sensorLabels={sensorLabels}
				sensorColors={config.sensorColors}
				showGridLines={config.showGridLines}
				showThresholdLines={config.showThresholdLines}
				thresholdLineOpacity={config.thresholdLineOpacity}
				showLegend={config.showLegend}
				showBorder={config.showBorder}
				showActivation={config.showActivation}
				activationColor={config.activationColor}
				sensorLabelColor={config.sensorLabelColor}
			/>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: root will always exist in our entry HTML
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<GraphOBSComponent />
	</StrictMode>,
);
