import { AlertTriangle, Download, Heart, Moon, Share, Smartphone, Sun, Unplug } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
	AboutDialog,
	GeneralSettingsSection,
	HeartRateMonitorSection,
	OBSSection,
	ProfilesSection,
	VisualSettingsSection,
} from "~/components/DashboardSidebar";
import MobileDashboard from "~/components/MobileDashboard";
import { OBSComponentDialog } from "~/components/OBSComponentDialog";
import PairingQRModal from "~/components/PairingQRModal";
import SensorBar from "~/components/SensorBar";
import TimeSeriesGraph from "~/components/TimeSeriesGraph";
import { Button } from "~/components/ui/button";
import { CustomScrollArea } from "~/components/ui/custom-scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { useHeartrateMonitor } from "~/lib/useHeartrateMonitor";
import { useOBS } from "~/lib/useOBS";
import { type ProfileData, useProfileManager } from "~/lib/useProfileManager";
import { usePWAInstall } from "~/lib/usePWAInstall";
import { useLastCode, useRemoteControl } from "~/lib/useRemoteControl";
import { useSerialPort } from "~/lib/useSerialPort";
import { useTheme } from "~/lib/useTheme";
import { useSensorCount } from "~/store/dataStore";
import type { DesktopMessage, MobileMessage, ProfileSyncPayload } from "~/store/remoteStore";
import {
	useBarVisualizationSettings,
	useColorSettings,
	useGeneralSettings,
	useGraphVisualizationSettings,
	useHeartrateSettings,
	useSettingsBulkActions,
} from "~/store/settingsStore";

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
	const subscribe = (callback: () => void) => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		mql.addEventListener("change", callback);
		return () => mql.removeEventListener("change", callback);
	};
	const getSnapshot = () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
	const getServerSnapshot = () => false;

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// annoying but needed to prevent re-renders of some components with specific callbacks
function useStableCallback<Args extends unknown[], R>(callback: (...args: Args) => R): (...args: Args) => R {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	const stableCallbackRef = useRef((...args: Args) => {
		callbackRef.current(...args);
	});

	return stableCallbackRef.current as (...args: Args) => R;
}

// Mock preview data for when pad is not connected
const MOCK_SENSOR_COUNT = 6;
const MOCK_SENSOR_VALUES = [280, 620, 445, 780, 390, 540];
const MOCK_THRESHOLDS = [480, 550, 420, 600, 510, 470];
const MOCK_SENSOR_LABELS = Array.from({ length: MOCK_SENSOR_COUNT }, (_, i) => `Sensor ${i + 1}`);

function generateMockTimeSeriesData(timeWindow: number): Array<Array<{ value: number; timestamp: number }>> {
	const now = Date.now();
	const pointCount = 120;
	const interval = timeWindow / (pointCount - 1);

	return Array.from({ length: MOCK_SENSOR_COUNT }, (_, sensorIndex) => {
		const baseValue = MOCK_SENSOR_VALUES[sensorIndex];
		const frequency = 0.8 + sensorIndex * 0.1;
		const amplitude = 60 + sensorIndex * 15;
		const phaseOffset = sensorIndex * 0.8;

		return Array.from({ length: pointCount }, (_, pointIndex) => {
			const t = pointIndex / (pointCount - 1);
			const sineComponent = Math.sin(t * Math.PI * 2 * frequency + phaseOffset) * amplitude;
			const secondaryWave = Math.sin(t * Math.PI * 4 * frequency + phaseOffset * 2) * (amplitude * 0.2);
			const value = Math.max(0, Math.min(1023, Math.round(baseValue + sineComponent + secondaryWave)));
			const timestamp = now - timeWindow + pointIndex * interval;
			return { value, timestamp };
		});
	});
}

const Dashboard = () => {
	const colorSettings = useColorSettings();
	const barSettings = useBarVisualizationSettings();
	const graphSettings = useGraphVisualizationSettings();
	const heartrateSettings = useHeartrateSettings();
	const generalSettings = useGeneralSettings();
	const { updateAllSettings, getAllSettings } = useSettingsBulkActions();

	const { isSupported, connect, disconnect, connected, connectionError, requestsPerSecond, sendText, latestData } = useSerialPort(
		generalSettings.pollingRate,
		generalSettings.useUnthrottledPolling,
		(values) => {
			const now = performance.now();

			// Broadcast to OBS
			if (obsConnected) {
				const minIntervalMs = Math.max(1, 1000 / Math.max(1, generalSettings.obsSendRate));

				if (now - lastBroadcastAtRef.current >= minIntervalMs) {
					lastBroadcastAtRef.current = now;
					void broadcast({ values, thresholds });
				}
			}

			// Broadcast to remote mobile device (30/sec)
			if (remoteConnected) {
				const remoteMinIntervalMs = 1000 / 30;

				if (now - lastRemoteBroadcastAtRef.current >= remoteMinIntervalMs) {
					lastRemoteBroadcastAtRef.current = now;
					sendRemote({ type: "values", payload: { values, timestamp: Date.now() } });
				}
			}
		},
	);

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

	const {
		profiles,
		activeProfile,
		activeProfileId,
		isLoading: isProfileLoading,
		error: profileError,
		createProfile,
		deleteProfile,
		updateProfile,
		setActiveProfileById,
		resetProfileToDefaults,
		updateThresholds,
		updateSensorLabels,
	} = useProfileManager();

	const { resolvedTheme, setTheme } = useTheme();

	const { lastCode, setLastCode } = useLastCode();
	const [showCodeChoice, setShowCodeChoice] = useState(false);

	const { canInstall, showIOSInstall, isInstalled, install } = usePWAInstall();
	const [installDismissed, setInstallDismissed] = useState(false);
	const showInstallBanner = !isInstalled && !installDismissed && (canInstall || showIOSInstall);

	const createProfileStable = useStableCallback(createProfile);
	const deleteProfileStable = useStableCallback(deleteProfile);
	const updateProfileStable = useStableCallback(updateProfile);
	const setActiveProfileByIdStable = useStableCallback(setActiveProfileById);
	const resetProfileToDefaultsStable = useStableCallback(resetProfileToDefaults);
	const toggleTheme = useStableCallback(() => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	});

	const [thresholds, setThresholds] = useState<number[]>([]);
	const [sensorLabels, setSensorLabels] = useState<string[]>([]);
	const [isSyncingProfile, setIsSyncingProfile] = useState<boolean>(false);
	const writebackTimeoutRef = useRef<number | null>(null);

	// Track which color picker popovers are open
	const [openColorPickers, setOpenColorPickers] = useState<boolean[]>([]);

	// OBS component dialog state
	const [obsComponentDialogOpen, setObsComponentDialogOpen] = useState<boolean>(false);
	const [obsPassword, setobsPassword] = useState<string>(activeProfile?.obsPassword ?? "");
	const [aboutOpen, setAboutOpen] = useState<boolean>(false);
	const [pairingModalOpen, setPairingModalOpen] = useState<boolean>(false);

	const isMobile = useIsMobile();

	// Dev only: toggle to hide disconnected overlay
	const [devHideOverlay, setDevHideOverlay] = useState<boolean>(import.meta.env.DEV);

	useEffect(() => {
		setobsPassword(activeProfile?.obsPassword ?? "");
	}, [activeProfile?.obsPassword]);

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
	const lastRemoteBroadcastAtRef = useRef<number>(0);

	// Mobile control connection handler
	const handleRemoteMessage = useStableCallback((message: DesktopMessage | MobileMessage) => {
		if (message.type === "threshold") {
			// Mobile sent a threshold change
			const { index, value } = message as { type: "threshold"; index: number; value: number };
			handleThresholdChange(index, value);
		} else if (message.type === "ready") {
			// Mobile is ready, send full sync
			sendProfileSync();
		}
	});

	const {
		isConnected: remoteConnected,
		isConnecting: remoteConnecting,
		code: remoteCode,
		connect: connectRemote,
		disconnect: disconnectRemote,
		send: sendRemote,
	} = useRemoteControl({
		role: "host",
		onPeerConnected: () => {
			// Send full profile sync when peer connects
			sendProfileSync();
		},
		onPeerDisconnected: () => {
			// no-op
		},
		onMessage: handleRemoteMessage,
	});

	// Save code when a peer successfully connects
	useEffect(() => {
		if (remoteConnected && remoteCode) {
			void setLastCode(remoteCode);
		}
	}, [remoteConnected, remoteCode]);

	// Build and send profile sync payload
	const sendProfileSync = useStableCallback(() => {
		if (!remoteConnected) return;

		const payload: ProfileSyncPayload = {
			thresholds,
			sensorLabels,
			sensorColors: colorSettings.sensorColors,
			thresholdColor: colorSettings.thresholdColor,
			useThresholdColor: barSettings.useThresholdColor,
			useSingleColor: barSettings.useSingleColor,
			singleBarColor: colorSettings.singleBarColor,
			isLocked: generalSettings.lockThresholds,
			theme: resolvedTheme,
		};

		sendRemote({ type: "sync", payload });
	});

	// Re-sync profile when settings change while connected
	useEffect(() => {
		if (!remoteConnected) return;
		sendProfileSync();
	}, [
		remoteConnected,
		thresholds,
		sensorLabels,
		colorSettings.sensorColors,
		colorSettings.thresholdColor,
		barSettings.useThresholdColor,
		barSettings.useSingleColor,
		colorSettings.singleBarColor,
		generalSettings.lockThresholds,
		resolvedTheme,
	]);

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

		// Update thresholds and sensor labels
		if (profile.thresholds.length > 0) {
			setThresholds(profile.thresholds);
		} else if (numSensors > 0) {
			const defaultThresholds = Array(numSensors).fill(512);
			setThresholds(defaultThresholds);
			if (activeProfileId) void updateThresholds(defaultThresholds);
		}

		if (profile.sensorLabels.length > 0) {
			setSensorLabels(profile.sensorLabels);
		} else if (numSensors > 0) {
			const defaultLabels = Array(numSensors)
				.fill("")
				.map((_, i) => `Sensor ${i + 1}`);
			setSensorLabels(defaultLabels);
			if (activeProfileId) void updateSensorLabels(defaultLabels);
		}
	};

	// Load active profile data into state
	useEffect(() => {
		if (!activeProfile) return;
		setIsSyncingProfile(true);
		syncUIStateWithProfile(activeProfile);
		// allow state to settle before enabling write-back again
		const id = window.setTimeout(() => setIsSyncingProfile(false), 0);
		return () => window.clearTimeout(id);
	}, [activeProfileId]);

	const getVisualSettingsFromUIState = () => getAllSettings();

	const updateProfileVisualSettings = () => {
		if (!activeProfileId) return;
		updateProfile(activeProfileId, getVisualSettingsFromUIState());
	};

	// Update profile when visual settings change, avoid during initial sync and debounce
	useEffect(() => {
		if (!activeProfileId || isSyncingProfile) return;

		if (writebackTimeoutRef.current) {
			window.clearTimeout(writebackTimeoutRef.current);
		}

		writebackTimeoutRef.current = window.setTimeout(() => {
			updateProfileVisualSettings();
		}, 100);

		return () => {
			if (writebackTimeoutRef.current) window.clearTimeout(writebackTimeoutRef.current);
		};
	}, [activeProfileId, colorSettings, barSettings, graphSettings, heartrateSettings, generalSettings, isSyncingProfile]);

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

	const onToggleAutoConnectStable = useStableCallback((checked: boolean, pwd: string) => {
		if (!pwd) return;
		setAutoConnectEnabled(checked && !!pwd, pwd);
	});

	const sensorBars = Array.from({ length: numSensors }, (_, index) => (
		<SensorBar
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
			theme={resolvedTheme}
		/>
	));

	// Render mobile layout
	if (isMobile) {
		return (
			<MobileDashboard
				sensorColors={colorSettings.sensorColors}
				thresholdColor={colorSettings.thresholdColor}
				useThresholdColor={barSettings.useThresholdColor}
				useSingleColor={barSettings.useSingleColor}
				singleBarColor={colorSettings.singleBarColor}
				theme={resolvedTheme}
				canInstallPWA={canInstall}
				showIOSInstall={showIOSInstall}
				isInstalled={isInstalled}
				onInstallPWA={install}
				profileName={activeProfile?.name}
			/>
		);
	}

	return (
		<main className="grid grid-cols-[17rem_1fr] h-screen w-screen bg-background text-foreground overflow-hidden">
			{/* Sidebar */}
			<div className="border-r border-border bg-gray-100 dark:bg-neutral-950 overflow-hidden">
				<div className="h-full w-full grid grid-rows-[auto_1fr]">
					<div className="p-3 border-b border-border flex items-center justify-between">
						{showInstallBanner ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="size-8 shrink-0"
										onClick={() => (canInstall ? install() : setInstallDismissed(true))}
										aria-label={canInstall ? "Install app" : "Install instructions"}
									>
										<Download className="size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="right" className="max-w-48">
									{canInstall ? (
										<p>Install WebFSR as an app</p>
									) : showIOSInstall ? (
										<p>
											Install as an app: tap <Share className="size-3 inline mx-0.5" /> then "Add to Home Screen"
										</p>
									) : null}
								</TooltipContent>
							</Tooltip>
						) : (
							<div className="size-8 shrink-0" />
						)}
						<h2 className="text-xl font-bold flex-1 text-center">WebFSR</h2>
						<Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={toggleTheme} aria-label="Toggle theme">
							{resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
						</Button>
					</div>

					<CustomScrollArea>
						<div className="p-4 flex flex-col gap-3">
							<Button onClick={handleConnectionToggle} className="w-full" disabled={!isSupported}>
								{connected ? "Disconnect from Pad" : "Connect to Pad"}
							</Button>

							<Button
								variant="outline"
								onClick={() => {
									setPairingModalOpen(true);
									// If not already connected, show choice if we have a last code
									if (!remoteConnected && !remoteConnecting) {
										if (lastCode) {
											setShowCodeChoice(true);
										} else {
											connectRemote();
										}
									}
								}}
								className="w-full gap-2"
							>
								<Smartphone className="size-4" />
								{remoteConnected ? "Mobile Connected" : "Pair Mobile Device"}
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

							{connectionError && <div className="text-sm text-destructive">Error connecting to device: {connectionError}</div>}

							{heartrateError && <div className="text-sm text-destructive">Error with HR monitor: {heartrateError}</div>}

							<div className="p-3 border rounded bg-white dark:bg-neutral-900">
								<div className="flex items-center justify-between">
									<span className="text-xs text-gray-600 dark:text-gray-400">Requests/sec:</span>
									<span className="text-sm font-medium">{requestsPerSecond}</span>
								</div>
							</div>

							<ProfilesSection
								profiles={profiles}
								activeProfile={activeProfile}
								activeProfileId={activeProfileId}
								isProfileLoading={isProfileLoading}
								profileError={profileError}
								createProfile={createProfileStable}
								deleteProfile={deleteProfileStable}
								updateProfile={updateProfileStable}
								setActiveProfileById={setActiveProfileByIdStable}
								resetProfileToDefaults={resetProfileToDefaultsStable}
							/>

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
								onToggleAutoConnect={onToggleAutoConnectStable}
								password={obsPassword}
								onPasswordChange={setobsPassword}
								activeProfile={activeProfile}
								activeProfileId={activeProfileId}
								updateProfile={updateProfileStable}
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

							{/* Dev only toggles */}
							{import.meta.env.DEV && (
								<div className="p-3 border rounded bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
									<label className="flex items-center gap-2 text-xs cursor-pointer">
										<input
											type="checkbox"
											checked={devHideOverlay}
											onChange={(e) => setDevHideOverlay(e.target.checked)}
											className="rounded"
										/>
										<span className="text-yellow-800">Hide overlay</span>
									</label>
								</div>
							)}

							<div className="pt-1 pb-1 flex flex-col items-center gap-0.5">
								<Button
									variant="link"
									size="sm"
									className="text-xs text-muted-foreground"
									onClick={() => setAboutOpen(true)}
									aria-label="About WebFSR"
								>
									About WebFSR
								</Button>
								<span className="text-[10px] text-muted-foreground font-mono opacity-70 break-all text-center">
									{__BUILD_TIMESTAMP__}
								</span>
							</div>
						</div>
					</CustomScrollArea>
				</div>
			</div>

			{/* Main content */}
			<div className="h-full overflow-hidden">
				<div className="h-full flex flex-col overflow-hidden p-2 relative">
					{latestData ? (
						<>
							{/* Bar Visualizations and Heartrate Section */}
							<div className="flex gap-2 shrink-0 h-100">
								{/* Bar Visualizations */}
								<div className="px-4 border rounded-lg bg-white dark:bg-neutral-900 shadow-sm grow">
									<div className="grid grid-flow-col auto-cols-fr gap-4 h-full w-full py-2">{sensorBars}</div>
								</div>

								{/* Heartrate Tracker */}
								{heartrateSettings.showHeartrateMonitor && (
									<div className="p-4 border rounded-lg bg-white dark:bg-neutral-900 shadow-sm aspect-square h-full flex flex-col items-center justify-center gap-2 min-w-64">
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
													<p className={`font-bold ${heartrateSettings.showBpmText ? "text-5xl" : "text-7xl"} leading-tight`}>
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
							<div className="p-1 border rounded-lg bg-white dark:bg-neutral-900 shadow-sm mt-2 grow min-h-0">
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
										theme={resolvedTheme}
									/>
								</div>
							</div>
						</>
					) : (
						// Preview dashboard when not connected or not supported
						<>
							{/* Mock visualizations */}
							{/* Mock Bar Visualizations and Heartrate Section */}
							<div className="flex gap-2 shrink-0 h-100">
								{/* Mock Bar Visualizations */}
								<div className="px-4 border rounded-lg bg-white dark:bg-neutral-900 shadow-sm grow">
									<div className="grid grid-flow-col auto-cols-fr gap-4 h-full w-full py-2">
										{Array.from({ length: MOCK_SENSOR_COUNT }, (_, index) => (
											<SensorBar
												key={`mock-sensor-${index}`}
												value={MOCK_SENSOR_VALUES[index]}
												index={index}
												threshold={MOCK_THRESHOLDS[index]}
												onThresholdChange={() => {}}
												label={MOCK_SENSOR_LABELS[index]}
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
												isLocked={true}
												theme={resolvedTheme}
											/>
										))}
									</div>
								</div>

								{/* Mock Heartrate Tracker */}
								{heartrateSettings.showHeartrateMonitor && (
									<div className="p-4 border rounded-lg bg-white dark:bg-neutral-900 shadow-sm aspect-square h-full flex flex-col items-center justify-center gap-2 min-w-64">
										<div
											className={`flex ${heartrateSettings.verticalAlignHeartrate ? "flex-col" : "flex-row"} items-center gap-4 w-full h-full justify-center`}
										>
											<Heart
												className={`${heartrateSettings.verticalAlignHeartrate ? "size-24" : "size-20"} text-muted-foreground`}
												fill="none"
											/>
											<p className="text-muted-foreground text-center text-lg">Heartrate monitor not connected</p>
										</div>
									</div>
								)}
							</div>

							{/* Mock Time Series Graph */}
							<div className="p-1 border rounded-lg bg-white dark:bg-neutral-900 shadow-sm mt-2 grow min-h-0">
								<div className="h-full">
									<TimeSeriesGraph
										latestData={null}
										timeWindow={graphSettings.timeWindow}
										thresholds={MOCK_THRESHOLDS}
										sensorLabels={MOCK_SENSOR_LABELS}
										sensorColors={colorSettings.sensorColors}
										showGridLines={graphSettings.showGridLines}
										showThresholdLines={graphSettings.showThresholdLines}
										thresholdLineOpacity={graphSettings.thresholdLineOpacity}
										showLegend={graphSettings.showLegend}
										showBorder={graphSettings.showGraphBorder}
										showActivation={graphSettings.showGraphActivation}
										activationColor={colorSettings.graphActivationColor}
										initialData={generateMockTimeSeriesData(graphSettings.timeWindow)}
										theme={resolvedTheme}
									/>
								</div>
							</div>

							{/* Overlay */}
							{!devHideOverlay && (
								<div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
									{!isSupported ? (
										<div className="max-w-md px-8 py-5 rounded-xl border border-destructive bg-background shadow-xl flex flex-col items-center gap-2">
											<div className="flex items-center gap-3 text-destructive">
												<AlertTriangle className="h-5 w-5" />
												<h2 className="text-lg font-semibold">WebSerial Not Supported</h2>
											</div>
											<p className="text-sm text-destructive text-center">
												Your browser does not support the WebSerial API. Try a modern Chromium-based browser.
											</p>
										</div>
									) : (
										<div className="px-8 py-5 rounded-xl border bg-background shadow-xl flex flex-col items-center gap-2">
											<div className="flex items-center gap-3">
												<Unplug className="h-5 w-5 text-muted-foreground" />
												<h2 className="text-lg font-semibold">Disconnected</h2>
											</div>
											<p className="text-sm text-muted-foreground">Connect your device and allow access to view data</p>
										</div>
									)}
								</div>
							)}
						</>
					)}
				</div>
			</div>

			<OBSComponentDialog open={obsComponentDialogOpen} onOpenChange={setObsComponentDialogOpen} password={obsPassword} />

			<AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

			<PairingQRModal
				open={pairingModalOpen}
				onOpenChange={(open) => {
					setPairingModalOpen(open);
					if (!open) {
						setShowCodeChoice(false);
					}
				}}
				code={remoteCode}
				isConnected={remoteConnected}
				isConnecting={remoteConnecting}
				onDisconnect={disconnectRemote}
				lastCode={lastCode}
				showCodeChoice={showCodeChoice}
				onUseLastCode={() => {
					setShowCodeChoice(false);
					if (lastCode) {
						connectRemote(lastCode);
					}
				}}
				onUseNewCode={() => {
					setShowCodeChoice(false);
					connectRemote();
				}}
			/>
		</main>
	);
};

export default Dashboard;
