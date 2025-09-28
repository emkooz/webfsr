import { AlertTriangle, Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	GeneralSettingsSection,
	HeartRateMonitorSection,
	OBSSection,
	ProfilesSection,
	VisualSettingsSection,
} from "~/components/DashboardSidebar";
import { OBSComponentDialog } from "~/components/OBSComponentDialog";
import SensorBar from "~/components/SensorBar";
import TimeSeriesGraph from "~/components/TimeSeriesGraph";
import { Button } from "~/components/ui/button";
import { CustomScrollArea } from "~/components/ui/custom-scroll-area";
import { useHeartrateMonitor } from "~/lib/useHeartrateMonitor";
import { useOBS } from "~/lib/useOBS";
import { type ProfileData, useProfileManager } from "~/lib/useProfileManager";
import { useSerialPort } from "~/lib/useSerialPort";
import { useSensorCount } from "~/store/dataStore";
import {
	useBarVisualizationSettings,
	useColorSettings,
	useGeneralSettings,
	useGraphVisualizationSettings,
	useHeartrateSettings,
	useSettingsBulkActions,
} from "~/store/settingsStore";

// annoying but needed to prevent re-renders of some components with specific callbacks
function useStableCallback<Args extends unknown[]>(callback: (...args: Args) => void): (...args: Args) => void {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	const stableCallbackRef = useRef((...args: Args) => {
		callbackRef.current(...args);
	});

	return stableCallbackRef.current;
}

const Dashboard = () => {
	const colorSettings = useColorSettings();
	const barSettings = useBarVisualizationSettings();
	const graphSettings = useGraphVisualizationSettings();
	const heartrateSettings = useHeartrateSettings();
	const generalSettings = useGeneralSettings();
	const { updateAllSettings, getAllSettings } = useSettingsBulkActions();

	const { isSupported, connect, disconnect, connected, connectionError, requestsPerSecond, sendText, latestData } =
		useSerialPort(generalSettings.pollingRate, generalSettings.useUnthrottledPolling, (values) => {
			if (!obsConnected) return;

			const now = performance.now();
			const minIntervalMs = Math.max(1, 1000 / Math.max(1, generalSettings.obsSendRate));

			if (now - lastBroadcastAtRef.current >= minIntervalMs) {
				lastBroadcastAtRef.current = now;
				void broadcast({ values, thresholds });
			}
		});

	const numSensors = useSensorCount();

	const {
		connect: connectHR,
		disconnect: disconnectHR,
		heartrateData,
		isConnected: connectedHR,
		isConnecting: connectingHR,
		error: heartrateError,
		isSupported: isBluetoothSupported,
		device: heartrateDevice,
	} = useHeartrateMonitor();

	const { activeProfile, activeProfileId, updateProfile, updateThresholds, updateSensorLabels } = useProfileManager();

	const [thresholds, setThresholds] = useState<number[]>([]);
	const [sensorLabels, setSensorLabels] = useState<string[]>([]);

	// Track which color picker popovers are open
	const [openColorPickers, setOpenColorPickers] = useState<boolean[]>([]);

	// OBS component dialog state
	const [obsComponentDialogOpen, setObsComponentDialogOpen] = useState<boolean>(false);

	// OBS connection state
	const {
		connect: connectOBS,
		disconnect: disconnectOBS,
		isConnected: obsConnected,
		isConnecting: obsConnecting,
		error: obsError,
		broadcast,
		autoConnect: obsAutoConnectEnabled,
		nextRetryInMs: obsNextRetryInMs,
		setAutoConnectEnabled,
	} = useOBS();
	const lastBroadcastAtRef = useRef<number>(0);

	// Calculate heart beat animation duration based on BPM
	const heartBeatDuration =
		!heartrateData?.heartrate || !heartrateSettings.animateHeartbeat
			? 0
			: // Convert BPM to duration in ms
				(60 / heartrateData.heartrate) * 1000;

	const heartBeatStyle = !heartBeatDuration
		? {}
		: {
				animation: `heartbeat ${heartBeatDuration}ms ease-in-out infinite`,
			};

	// This should probably be done in the tailwind config but can refactor that later
	useEffect(() => {
		if (!document.getElementById("heartbeat-animation")) {
			const style = document.createElement("style");
			style.id = "heartbeat-animation";
			style.innerHTML = `
				@keyframes heartbeat {
					0%, 100% { transform: scale(1); }
					15% { transform: scale(1.2); }
					30% { transform: scale(1); }
					45% { transform: scale(1.15); }
					60% { transform: scale(1); }
				}
			`;
			document.head.appendChild(style);
		}
	}, []);

	// Handle heart rate connection toggle
	const handleHeartrateToggle = useStableCallback(async () => {
		if (!isBluetoothSupported) return;

		if (connectedHR) {
			await disconnectHR();
		} else {
			await connectHR();
		}
	});

	const sendAllThresholds = () => {
		if (!connected || !thresholds.length) return;

		thresholds.forEach((value, index) => {
			const message = `${index} ${value}\n`;
			sendText(message);
		});
	};

	// Send all thresholds when connection is established
	useEffect(() => {
		if (connected) sendAllThresholds();
	}, [connected]);

	// Send all thresholds when profile changes
	useEffect(() => {
		if (activeProfileId && connected) sendAllThresholds();
	}, [activeProfileId, connected]);

	// Synchronize UI state with profile data
	const syncUIStateWithProfile = (profile: ProfileData) => {
		if (!profile) return;

		updateAllSettings({
			sensorColors: profile.sensorColors,
			showBarThresholdText: profile.showBarThresholdText,
			showBarValueText: profile.showBarValueText,
			thresholdColor: profile.thresholdColor,
			useThresholdColor: profile.useThresholdColor,
			useSingleColor: profile.useSingleColor,
			singleBarColor: profile.singleBarColor,
			useBarGradient: profile.useBarGradient,
			showGridLines: profile.showGridLines,
			showThresholdLines: profile.showThresholdLines,
			thresholdLineOpacity: profile.thresholdLineOpacity,
			showLegend: profile.showLegend,
			showGraphBorder: profile.showGraphBorder,
			showGraphActivation: profile.showGraphActivation,
			graphActivationColor: profile.graphActivationColor,
			timeWindow: profile.timeWindow,
			showHeartrateMonitor: profile.showHeartrateMonitor,
			lockThresholds: profile.lockThresholds,
			verticalAlignHeartrate: profile.verticalAlignHeartrate,
			fillHeartIcon: profile.fillHeartIcon,
			showBpmText: profile.showBpmText,
			animateHeartbeat: profile.animateHeartbeat,
			pollingRate: profile.pollingRate,
			useUnthrottledPolling: profile.useUnthrottledPolling,
		});

		// Only update thresholds and sensor labels if they exist in the profile
		if (profile.thresholds.length > 0) setThresholds(profile.thresholds);
		if (profile.sensorLabels.length > 0) setSensorLabels(profile.sensorLabels);
	};

	// Load active profile data into state
	useEffect(() => {
		if (activeProfile) syncUIStateWithProfile(activeProfile);
	}, [activeProfileId]);

	const getVisualSettingsFromUIState = () => getAllSettings();

	const updateProfileVisualSettings = () => {
		if (!activeProfileId) return;
		updateProfile(activeProfileId, getVisualSettingsFromUIState());
	};

	// Update profile when visual settings change
	useEffect(() => {
		if (activeProfileId) updateProfileVisualSettings();
	}, [activeProfileId, colorSettings, barSettings, graphSettings, heartrateSettings, generalSettings]);

	// Initialize defaults when number of sensors changes
	useEffect(() => {
		if (numSensors === 0) return;

		// Initialize missing thresholds with default value
		if (thresholds.length !== numSensors) {
			const newThresholds = Array(numSensors).fill(512);
			setThresholds(newThresholds);

			if (activeProfileId) updateThresholds(newThresholds);
		}

		// Initialize missing sensor labels
		if (sensorLabels.length !== numSensors) {
			const newLabels = Array(numSensors)
				.fill("")
				.map((_, i) => `Sensor ${i + 1}`);

			setSensorLabels(newLabels);

			if (activeProfileId) updateSensorLabels(newLabels);
		}

		// Initialize color picker open state
		if (openColorPickers.length !== numSensors) setOpenColorPickers(Array(numSensors).fill(false));
	}, [numSensors, thresholds.length, sensorLabels.length, openColorPickers.length, activeProfileId]);

	const handleThresholdChange = useStableCallback((index: number, value: number) => {
		const newThresholds = [...thresholds];
		newThresholds[index] = value;
		setThresholds(newThresholds);

		if (activeProfileId) updateThresholds(newThresholds);

		// Send threshold update to serial port if connected
		if (connected) {
			const message = `${index} ${value}\n`;
			sendText(message);
		}
	});

	const onLabelChangeStable = useStableCallback((index: number, value: string) => {
		const newLabels = [...sensorLabels];
		newLabels[index] = value;
		setSensorLabels(newLabels);

		if (activeProfileId) updateSensorLabels(newLabels);
	});

	const handleConnectionToggle = useStableCallback(async () => {
		if (!isSupported) return;

		if (connected) {
			await disconnect();
			return;
		}
		await connect();
	});

	const onObsToggleStable = useStableCallback((pwd: string) => {
		if (!pwd) return;
		if (obsConnected) {
			void disconnectOBS();
			return;
		}
		void connectOBS(pwd);
	});

	// Enable auto-connect per profile
	useEffect(() => {
		if (!activeProfile) return;
		const shouldAuto = Boolean((activeProfile as { obsAutoConnect?: boolean }).obsAutoConnect);
		const pwd = activeProfile.obsPassword || "";

		// only enable if password present
		setAutoConnectEnabled(shouldAuto && !!pwd, pwd);

		// If auto-connect is enabled at page load and we're idle, schedule immediately
		if (shouldAuto && pwd && !obsConnected && !obsConnecting) {
			setAutoConnectEnabled(true, pwd);
		}
	}, [activeProfile?.id, activeProfile?.obsPassword, (activeProfile as { obsAutoConnect?: boolean })?.obsAutoConnect]);

	const onCreateComponent = useStableCallback(() => {
		setObsComponentDialogOpen(true);
	});

	const sensorBars = Array.from({ length: numSensors }, (_, index) => (
		<SensorBar
			// biome-ignore lint/suspicious/noArrayIndexKey:
			key={`sensor-${index}`}
			value={latestData?.values[index] || 0}
			index={index}
			threshold={thresholds[index] || 512}
			onThresholdChange={handleThresholdChange}
			label={sensorLabels[index] || `Sensor ${index + 1}`}
			color={
				barSettings.useSingleColor
					? colorSettings.singleBarColor
					: colorSettings.sensorColors[index % colorSettings.sensorColors.length] || "#ff0000"
			}
			showThresholdText={barSettings.showBarThresholdText}
			showValueText={barSettings.showBarValueText}
			thresholdColor={colorSettings.thresholdColor}
			useThresholdColor={barSettings.useThresholdColor}
			useGradient={barSettings.useBarGradient}
			isLocked={generalSettings.lockThresholds}
		/>
	));

	return (
		<main className="grid grid-cols-[17rem_1fr] h-screen w-screen bg-background text-foreground overflow-hidden">
			{/* Sidebar */}
			<div className="border-r border-border bg-gray-100 overflow-hidden">
				<div className="h-full w-full grid grid-rows-[auto_1fr]">
					<div className="p-3 border-b border-border ">
						<h2 className="text-xl font-bold text-center">WebFSR</h2>
					</div>

					<CustomScrollArea>
						<div className="p-4 flex flex-col gap-3">
							<Button onClick={handleConnectionToggle} className="w-full" disabled={!isSupported}>
								{connected ? "Disconnect from pad" : "Connect to pad"}
							</Button>

							<div className="grid grid-cols-2 gap-1 text-xs text-center">
								<div className="font-medium">
									Pad:{" "}
									<span className={`${connected ? "text-green-500" : "text-destructive"}`}>
										{connected ? " Connected" : " Disconnected"}
									</span>
								</div>

								<div className="font-medium">
									ITG: <span className={"text-destructive"}>Disconnected</span>
								</div>

								<div className="font-medium col-span-2">
									HR Monitor:{" "}
									<span className={`${connectedHR ? "text-green-500" : "text-destructive"}`}>
										{connectingHR ? "Attempting connection..." : connectedHR ? " Connected" : " Disconnected"}
									</span>
								</div>
							</div>

							{connectionError && (
								<div className="text-sm text-destructive">Error connecting to device: {connectionError}</div>
							)}

							{heartrateError && (
								<div className="text-sm text-destructive">Error with HR monitor: {heartrateError}</div>
							)}

							<div className="p-3 border rounded bg-white">
								<div className="flex items-center justify-between">
									<span className="text-xs text-gray-600">Requests/sec:</span>
									<span className="text-sm font-medium">{requestsPerSecond}</span>
								</div>
							</div>

							<ProfilesSection />

							<OBSSection
								obsConnected={obsConnected}
								obsConnecting={obsConnecting}
								obsError={obsError}
								obsSendRate={generalSettings.obsSendRate}
								setObsSendRate={generalSettings.setObsSendRate}
								onToggle={onObsToggleStable}
								onCreateComponent={onCreateComponent}
								autoConnectEnabled={obsAutoConnectEnabled}
								nextRetryInMs={obsNextRetryInMs}
								onToggleAutoConnect={(checked, pwd) => {
									if (!pwd) return;
									setAutoConnectEnabled(checked && !!pwd, pwd);
								}}
							/>

							<GeneralSettingsSection generalSettings={generalSettings} />

							<HeartRateMonitorSection
								heartrateSettings={heartrateSettings}
								onToggle={handleHeartrateToggle}
								connectedHR={connectedHR}
								isBluetoothSupported={isBluetoothSupported}
								heartrateDevice={heartrateDevice}
								heartrateData={heartrateData}
							/>

							<VisualSettingsSection
								numSensors={numSensors}
								sensorLabels={sensorLabels}
								onLabelChange={onLabelChangeStable}
								openColorPickers={openColorPickers}
								setOpenColorPickers={setOpenColorPickers}
							/>
						</div>
					</CustomScrollArea>
				</div>
			</div>

			{/* Main content */}
			<div className="h-full overflow-hidden">
				{!isSupported ? (
					<div className="h-full flex items-center justify-center bg-muted/50">
						<div className="max-w-md p-6 rounded-lg border border-destructive bg-destructive/10 text-destructive">
							<div className="flex gap-2 items-center pb-4">
								<AlertTriangle className="h-5 w-5" />
								<h2 className="text-lg font-semibold">WebSerial Not Supported</h2>
							</div>
							<p>Your browser does not support the WebSerial API. Try a modern Chromium-based browser.</p>
						</div>
					</div>
				) : (
					<div className="h-full flex flex-col overflow-hidden p-2">
						{latestData ? (
							<>
								{/* Bar Visualizations and Heartrate Section */}
								<div className="flex gap-2 flex-shrink-0 h-[25rem]">
									{/* Bar Visualizations */}
									<div className="px-4 border rounded-lg bg-white shadow-sm flex-grow">
										<div className="grid grid-flow-col auto-cols-fr gap-4 h-full w-full py-2">{sensorBars}</div>
									</div>

									{/* Heartrate Tracker */}
									{heartrateSettings.showHeartrateMonitor && (
										<div className="p-4 border rounded-lg bg-white shadow-sm aspect-square h-full flex flex-col items-center justify-center gap-2 min-w-64">
											<div
												className={`flex ${heartrateSettings.verticalAlignHeartrate ? "flex-col" : "flex-row"} items-center gap-4 w-full h-full justify-center`}
											>
												<Heart
													className={`${heartrateSettings.verticalAlignHeartrate ? "size-24" : "size-20"} ${connectedHR ? "text-red-500" : "text-muted-foreground"}`}
													fill={heartrateSettings.fillHeartIcon ? (connectedHR ? "currentColor" : "none") : "none"}
													// Again should probably be done with tailwind config lol
													style={connectedHR && heartrateData ? heartBeatStyle : {}}
												/>
												{connectedHR && heartrateData ? (
													<div className="text-center">
														<p
															className={`font-bold ${heartrateSettings.showBpmText ? "text-5xl" : "text-7xl"} leading-tight`}
														>
															{heartrateData.heartrate}
														</p>
														{heartrateSettings.showBpmText && <p className="text-lg text-muted-foreground mt-1">BPM</p>}
													</div>
												) : (
													<p className="text-muted-foreground text-center text-lg">
														{isBluetoothSupported
															? connectedHR
																? "Waiting for heartrate data..."
																: "Heartrate monitor not connected"
															: "WebBluetooth not supported"}
													</p>
												)}
											</div>
										</div>
									)}
								</div>

								{/* Time Series Graph */}
								<div className="p-1 border rounded-lg bg-white shadow-sm mt-2 flex-grow min-h-0">
									<div className="h-full">
										<TimeSeriesGraph
											latestData={latestData}
											timeWindow={graphSettings.timeWindow}
											thresholds={thresholds}
											sensorLabels={sensorLabels}
											sensorColors={colorSettings.sensorColors}
											showGridLines={graphSettings.showGridLines}
											showThresholdLines={graphSettings.showThresholdLines}
											thresholdLineOpacity={graphSettings.thresholdLineOpacity}
											showLegend={graphSettings.showLegend}
											showBorder={graphSettings.showGraphBorder}
											showActivation={graphSettings.showGraphActivation}
											activationColor={colorSettings.graphActivationColor}
										/>
									</div>
								</div>
							</>
						) : (
							<div className="flex h-full items-center justify-center text-muted-foreground">
								<p>Connect a device to see sensor data</p>
							</div>
						)}
					</div>
				)}
			</div>

			<OBSComponentDialog open={obsComponentDialogOpen} onOpenChange={setObsComponentDialogOpen} />
		</main>
	);
};

export default Dashboard;
