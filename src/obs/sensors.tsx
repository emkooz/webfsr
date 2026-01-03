import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import SensorBar from "~/components/SensorBar";
import { type ObsBroadcastPayload, useOBS } from "~/lib/useOBS";

type ObsPayload = ObsBroadcastPayload & {
	eventType?: string;
};

// Default configuration values
const DEFAULT_CONFIG = {
	sensorColors: ["#3a7da3", "#d4607c", "#8670d4", "#d49b20", "#459ea0", "#d45478"],
	thresholdLineOpacity: 0.7,
	showThresholdText: true,
	showValueText: true,
	useThresholdColor: true,
	useSingleColor: false,
	useGradient: false,
	thresholdColor: "#4dd253",
	singleBarColor: "#3b82f6",
	backgroundColor: "transparent",
	hideLabels: false,
	hideControls: true,
	visibleSensors: "", // Comma-separated list of sensor indices (e.g., "0,2,4" or "all")
	sensorBackgroundColor: "white",
	sensorLabelColor: "rgba(255, 255, 255, 0.9)",
	sensorLabels: [],
};

function getQueryPassword() {
	const params = new URLSearchParams(window.location.search);
	return params.get("pwd") || "";
}

function parseQueryConfig() {
	const params = new URLSearchParams(window.location.search);

	return {
		sensorColors: (() => {
			const raw = params.get("colors");
			if (!raw) return [...DEFAULT_CONFIG.sensorColors];
			// Support rgba colors that contain commas by using semicolon-separated values
			const parts = raw.includes(";") ? raw.split(";") : raw.split(",");
			return parts.map((p) => decodeURIComponent(p));
		})(),
		thresholdLineOpacity: Number(params.get("thresholdOpacity")) || DEFAULT_CONFIG.thresholdLineOpacity,
		showThresholdText: params.get("showThreshold") !== "false" ? DEFAULT_CONFIG.showThresholdText : false,
		showValueText: params.get("showValue") !== "false" ? DEFAULT_CONFIG.showValueText : false,
		useThresholdColor: params.get("useThresholdColor") === "true" ? true : DEFAULT_CONFIG.useThresholdColor,
		useSingleColor: params.get("singleColor") === "true" ? true : DEFAULT_CONFIG.useSingleColor,
		useGradient: params.get("gradient") === "true" ? true : DEFAULT_CONFIG.useGradient,
		thresholdColor: params.get("thresholdColor") || DEFAULT_CONFIG.thresholdColor,
		singleBarColor: params.get("singleBarColor") || DEFAULT_CONFIG.singleBarColor,
		backgroundColor: params.get("backgroundColor") || DEFAULT_CONFIG.backgroundColor,
		hideLabels: params.get("hideLabels") === "true" ? true : DEFAULT_CONFIG.hideLabels,
		hideControls: params.get("hideControls") === "true" ? true : DEFAULT_CONFIG.hideControls,
		visibleSensors: params.get("sensors") || DEFAULT_CONFIG.visibleSensors,
		sensorBackgroundColor: params.get("sensorBg") || DEFAULT_CONFIG.sensorBackgroundColor,
		sensorLabelColor: params.get("labelColor") || DEFAULT_CONFIG.sensorLabelColor,
		sensorLabels: (() => {
			const raw = params.get("sensorLabels");
			if (!raw) return [...DEFAULT_CONFIG.sensorLabels];
			// Support labels that might contain commas by using semicolon-separated values
			return raw.split(";").map((label) => decodeURIComponent(label));
		})(),
	};
}

function SensorsOBSComponent() {
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

				if (payload.values && Array.isArray(payload.values)) setLatestData({ values: payload.values });

				if (payload.thresholds && Array.isArray(payload.thresholds)) setThresholds(payload.thresholds);

				// Generate sensor labels if we don't have them
				if (sensorLabels.length === 0 && payload.values) {
					const numSensors = payload.values.length;
					const configuredLabels = config.sensorLabels.length > 0 ? config.sensorLabels : [];

					const newLabels = Array.from({ length: numSensors }, (_, i) => {
						return configuredLabels[i] || `Sensor ${i + 1}`;
					});

					setSensorLabels(newLabels);
				}
			} catch {
				// ignore
			}
		});
		return unmount;
	}, [addCustomEventListener, sensorLabels.length]);

	if (!isConnected && !isConnecting) {
		return (
			<div className="w-full h-screen flex items-center justify-center bg-transparent">
				<div className="px-6 py-4 rounded-lg border bg-white/70 text-gray-900 shadow-sm">
					<h1 className="text-lg font-semibold">WebFSR OBS Sensors</h1>
					<p className="text-sm text-gray-700">Status: {isConnecting ? "Connecting…" : isConnected ? "Connected" : "Disconnected"}</p>
					{error && <p className="text-sm text-red-600">{error}</p>}
					{!pwd && <p className="text-sm text-amber-600">No password provided in URL</p>}
				</div>
			</div>
		);
	}

	const numSensors = latestData?.values.length || 0;

	const getVisibleSensors = () => {
		if (!config.visibleSensors || config.visibleSensors === "all") return Array.from({ length: numSensors }, (_, i) => i);

		return config.visibleSensors
			.split(",")
			.map((s) => Number.parseInt(s.trim(), 10))
			.filter((i) => !Number.isNaN(i) && i >= 0 && i < numSensors);
	};

	const visibleSensorIndices = getVisibleSensors();

	const sensorBars = visibleSensorIndices.map((sensorIndex) => (
		<SensorBar
			key={`obs-sensor-${sensorIndex}-${numSensors}`}
			value={latestData?.values[sensorIndex] || 0}
			index={sensorIndex}
			threshold={thresholds[sensorIndex] || 512}
			onThresholdChange={() => {
				// In OBS don't allow threshold changes
			}}
			label={sensorLabels[sensorIndex] || `Sensor ${sensorIndex + 1}`}
			color={config.useSingleColor ? config.singleBarColor : config.sensorColors[sensorIndex % config.sensorColors.length] || "#ff0000"}
			showThresholdText={config.showThresholdText}
			showValueText={config.showValueText}
			thresholdColor={config.thresholdColor}
			useThresholdColor={config.useThresholdColor}
			useGradient={config.useGradient}
			isLocked={true}
			hideLabel={config.hideLabels}
			hideControls={config.hideControls}
			backgroundColor={config.sensorBackgroundColor}
			labelColor={config.sensorLabelColor}
		/>
	));

	const renderSensors = () => {
		return <div className="flex gap-4 h-full items-center justify-center">{sensorBars}</div>;
	};

	return (
		<div className="w-full h-screen" style={{ backgroundColor: config.backgroundColor }}>
			{renderSensors()}
		</div>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<SensorsOBSComponent />
	</StrictMode>,
);
