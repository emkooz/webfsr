import { useState, useEffect, useRef, type SetStateAction, type Dispatch } from "react";
import {
	AlertTriangle,
	ChevronDown,
	ChevronRight,
	HelpCircle,
	Check,
	ChevronsUpDown,
	Plus,
	Pencil,
	Trash2,
	Heart,
	Undo,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useSerialPort } from "~/lib/useSerialPort";
import { useHeartrateMonitor } from "~/lib/useHeartrateMonitor";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { HexColorPicker } from "react-colorful";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { CustomScrollArea } from "~/components/ui/custom-scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import SensorBar from "~/components/SensorBar";
import TimeSeriesGraph from "~/components/TimeSeriesGraph";
import { useProfileManager, type ProfileData } from "~/lib/useProfileManager";
import { cn } from "~/lib/utils";
import {
	useColorSettings,
	useBarVisualizationSettings,
	useGraphVisualizationSettings,
	useHeartrateSettings,
	useGeneralSettings,
	useSettingsBulkActions,
} from "~/store/settingsStore";
import { useSensorCount } from "~/store/dataStore";

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
	const { isSupported, connect, disconnect, connected, connectionError, requestsPerSecond, sendText, latestData } =
		useSerialPort();

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
		updateThresholds,
		updateSensorLabels,
		resetProfileToDefaults,
	} = useProfileManager();

	const [connectedITG, setConnectedITG] = useState<boolean>(false);
	const [thresholds, setThresholds] = useState<number[]>([]);
	const [sensorLabels, setSensorLabels] = useState<string[]>([]);

	// Get settings from store using selectors for better organization
	const colorSettings = useColorSettings();
	const barSettings = useBarVisualizationSettings();
	const graphSettings = useGraphVisualizationSettings();
	const heartrateSettings = useHeartrateSettings();
	const generalSettings = useGeneralSettings();
	const { updateAllSettings, getAllSettings } = useSettingsBulkActions();

	// Profile management states
	const [profileComboboxOpen, setProfileComboboxOpen] = useState(false);
	const [newProfileDialogOpen, setNewProfileDialogOpen] = useState(false);
	const [renameProfileDialogOpen, setRenameProfileDialogOpen] = useState(false);
	const [deleteProfileDialogOpen, setDeleteProfileDialogOpen] = useState(false);
	const [resetProfileDialogOpen, setResetProfileDialogOpen] = useState(false);
	const [profileNameInput, setProfileNameInput] = useState("");
	const [isProfilesOpen, setIsProfilesOpen] = useState(true);

	// General settings
	const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState<boolean>(true);

	// Track which color picker popovers are open
	const [openColorPickers, setOpenColorPickers] = useState<boolean[]>([]);

	// Collapsible state for sections
	const [isVisualsOpen, setIsVisualsOpen] = useState<boolean>(true);
	const [isGeneralVisualsOpen, setIsGeneralVisualsOpen] = useState<boolean>(true);
	const [isBarVisualsOpen, setIsBarVisualsOpen] = useState<boolean>(true);
	const [isGraphVisualsOpen, setIsGraphVisualsOpen] = useState<boolean>(true);
	const [isLastResultOpen, setIsLastResultOpen] = useState<boolean>(true);
	const [isThresholdsOpen, setIsThresholdsOpen] = useState<boolean>(true);

	// Collapsible state for heartrate monitor
	const [isHeartrateOpen, setIsHeartrateOpen] = useState<boolean>(true);

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

	// Function to send all thresholds to the microcontroller
	const sendAllThresholds = () => {
		if (!connected || !thresholds.length) return;

		// Send each threshold to the microcontroller
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

		// Update all settings at once using the bulk update function
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
		});

		// Only update thresholds and sensor labels if they exist in the profile
		if (profile.thresholds.length > 0) setThresholds(profile.thresholds);
		if (profile.sensorLabels.length > 0) setSensorLabels(profile.sensorLabels);
	};

	// Load active profile data into state
	useEffect(() => {
		if (activeProfile) syncUIStateWithProfile(activeProfile);
	}, [activeProfileId]);

	// Get all visual settings from UI state
	const getVisualSettingsFromUIState = () => getAllSettings();

	const updateProfileVisualSettings = () => {
		if (!activeProfileId) return;
		updateProfile(activeProfileId, getVisualSettingsFromUIState());
	};

	// Update profile when visual settings change
	useEffect(() => {
		if (activeProfileId) updateProfileVisualSettings();
	}, [activeProfileId, colorSettings, barSettings, graphSettings, heartrateSettings, generalSettings]);

	// Handle creating a new profile
	const handleCreateProfile = async () => {
		if (!profileNameInput.trim()) return;

		const newProfile = await createProfile(profileNameInput, activeProfileId || undefined);
		setProfileNameInput("");
		setNewProfileDialogOpen(false);
		if (newProfile?.id) setActiveProfileById(newProfile.id);
	};

	// Handle renaming the active profile
	const handleRenameProfile = async () => {
		if (!activeProfileId || !profileNameInput.trim()) return;

		await updateProfile(activeProfileId, { name: profileNameInput });
		setProfileNameInput("");
		setRenameProfileDialogOpen(false);
	};

	// Handle deleting the active profile
	const handleDeleteProfile = async () => {
		if (!activeProfileId) return;

		await deleteProfile(activeProfileId);
		setDeleteProfileDialogOpen(false);
	};

	// Handle resetting the active profile to default values
	const handleResetProfile = async () => {
		if (!activeProfileId) return;

		const resetProfile = await resetProfileToDefaults(activeProfileId);
		if (resetProfile) syncUIStateWithProfile(resetProfile);

		setResetProfileDialogOpen(false);
	};

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

	const handleLabelChange = (index: number, value: string) => {
		const newLabels = [...sensorLabels];
		newLabels[index] = value;
		setSensorLabels(newLabels);

		if (activeProfileId) updateSensorLabels(newLabels);
	};

	const handleConnectionToggle = useStableCallback(async () => {
		if (!isSupported) return;

		if (connected) {
			await disconnect();
			return;
		}
		await connect();
	});

	const handleColorChange = (index: number, color: string) => {
		const newColors = [...colorSettings.sensorColors];
		newColors[index] = color;
		colorSettings.setSensorColors(newColors);
	};

	const handleTimeWindowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = Number.parseInt(e.target.value, 10);
		graphSettings.setTimeWindow(Number.isNaN(value) || value < 0 ? 0 : value);
	};

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
									ITG:{" "}
									<span className={`${connectedITG ? "text-green-500" : "text-destructive"}`}>
										{connectedITG ? " Connected" : " Disconnected"}
									</span>
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

							{/* Profile Management Section */}
							<Collapsible
								open={isProfilesOpen}
								onOpenChange={setIsProfilesOpen}
								className="p-3 border rounded bg-white"
							>
								<CollapsibleTrigger className="flex items-center justify-between w-full">
									<span className="text-sm font-semibold">Profiles</span>
									{isProfilesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-3">
									{isProfileLoading ? (
										<div className="text-xs text-center py-2">Loading profiles...</div>
									) : (
										<>
											<Popover open={profileComboboxOpen} onOpenChange={setProfileComboboxOpen}>
												<PopoverTrigger asChild>
													<Button
														variant="outline"
														aria-expanded={profileComboboxOpen}
														className="w-full justify-between"
													>
														{activeProfile ? activeProfile.name : "Select profile..."}
														<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-full p-0">
													<Command>
														<CommandInput placeholder="Search profiles..." />
														<CommandList>
															<CommandEmpty>No profiles found.</CommandEmpty>
															<CommandGroup>
																{profiles.map((profile) => (
																	<CommandItem
																		key={profile.id}
																		value={profile.name}
																		onSelect={() => {
																			if (profile.id) setActiveProfileById(profile.id);

																			setProfileComboboxOpen(false);
																		}}
																	>
																		<Check
																			className={cn(
																				"mr-2 size-4",
																				activeProfileId === profile.id ? "opacity-100" : "opacity-0",
																			)}
																		/>
																		{profile.name}
																	</CommandItem>
																))}
															</CommandGroup>
														</CommandList>
													</Command>
												</PopoverContent>
											</Popover>

											{profileError && <div className="text-xs text-destructive mt-2">{profileError}</div>}

											<div className="flex gap-2 mt-3">
												<Button
													size="sm"
													variant="outline"
													className="flex-1"
													onClick={() => {
														setProfileNameInput("");
														setNewProfileDialogOpen(true);
													}}
												>
													<Plus className="size-4" />
												</Button>
												<Button
													size="sm"
													variant="outline"
													className="flex-1"
													disabled={!activeProfile}
													onClick={() => {
														if (activeProfile) {
															setProfileNameInput(activeProfile.name);
															setRenameProfileDialogOpen(true);
														}
													}}
												>
													<Pencil className="size-4" />
												</Button>
												<Button
													size="sm"
													variant="outline"
													className="flex-1"
													disabled={!activeProfile}
													onClick={() => setResetProfileDialogOpen(true)}
												>
													<Undo className="size-4" />
												</Button>
												<Button
													size="sm"
													variant="outline"
													className="flex-1"
													disabled={!activeProfile || profiles.length <= 1}
													onClick={() => setDeleteProfileDialogOpen(true)}
												>
													<Trash2 className="size-4" />
												</Button>
											</div>
										</>
									)}
								</CollapsibleContent>
							</Collapsible>

							{/* General Settings */}
							<Collapsible
								open={isGeneralSettingsOpen}
								onOpenChange={setIsGeneralSettingsOpen}
								className="p-3 border rounded bg-white"
							>
								<CollapsibleTrigger className="flex items-center justify-between w-full">
									<span className="text-sm font-semibold">General</span>
									{isGeneralSettingsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-3">
									<div className="flex flex-col gap-2">
										<div className="flex items-center justify-between">
											<span className="text-xs">Lock thresholds</span>
											<Switch
												checked={generalSettings.lockThresholds}
												onCheckedChange={generalSettings.setLockThresholds}
												aria-label="Toggle threshold locking"
											/>
										</div>
									</div>
								</CollapsibleContent>
							</Collapsible>

							{/* Heart Rate Monitor Section */}
							<Collapsible
								open={isHeartrateOpen}
								onOpenChange={setIsHeartrateOpen}
								className="p-3 border rounded bg-white"
							>
								<CollapsibleTrigger className="flex items-center justify-between w-full">
									<span className="text-sm font-semibold">Heartrate Monitor</span>
									{isHeartrateOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-3">
									<div className="flex flex-col gap-3">
										<Button onClick={handleHeartrateToggle} className="w-full" disabled={!isBluetoothSupported}>
											{connectedHR ? "Disconnect HR monitor" : "Connect HR monitor"}
										</Button>

										{heartrateDevice && (
											<div className="text-xs">
												<div>Connected to:</div>
												<div className="font-medium">
													{heartrateDevice.name || "Unknown device"}{" "}
													{heartrateData?.heartrate ? `(${heartrateData.heartrate} bpm)` : ""}
												</div>
											</div>
										)}

										<div className="flex items-center justify-between">
											<span className="text-xs">Show heartrate monitor</span>
											<Switch
												checked={heartrateSettings.showHeartrateMonitor}
												onCheckedChange={heartrateSettings.setShowHeartrateMonitor}
												aria-label="Toggle heartrate monitor display"
											/>
										</div>

										{heartrateSettings.showHeartrateMonitor && (
											<>
												<div className="flex items-center justify-between">
													<span className="text-xs">Animate heartbeat</span>
													<Switch
														checked={heartrateSettings.animateHeartbeat}
														onCheckedChange={heartrateSettings.setAnimateHeartbeat}
														aria-label="Toggle heart animation"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Vertical align content</span>
													<Switch
														checked={heartrateSettings.verticalAlignHeartrate}
														onCheckedChange={heartrateSettings.setVerticalAlignHeartrate}
														aria-label="Toggle vertical alignment of heartrate content"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Fill heart icon</span>
													<Switch
														checked={heartrateSettings.fillHeartIcon}
														onCheckedChange={heartrateSettings.setFillHeartIcon}
														aria-label="Toggle filled heart icon"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show BPM text</span>
													<Switch
														checked={heartrateSettings.showBpmText}
														onCheckedChange={heartrateSettings.setShowBpmText}
														aria-label="Toggle BPM label display"
													/>
												</div>
											</>
										)}
									</div>
								</CollapsibleContent>
							</Collapsible>

							{/* Visual Customization */}
							<Collapsible open={isVisualsOpen} onOpenChange={setIsVisualsOpen} className="p-3 border rounded bg-white">
								<CollapsibleTrigger className="flex items-center justify-between w-full">
									<span className="text-sm font-semibold">Visual Settings</span>
									{isVisualsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-1">
									{/* General Visuals */}
									<Collapsible
										open={isGeneralVisualsOpen}
										onOpenChange={setIsGeneralVisualsOpen}
										className="mt-2 border-t pt-2"
									>
										<CollapsibleTrigger className="flex items-center justify-between w-full">
											<span className="text-xs font-medium">General</span>
											{isGeneralVisualsOpen ? (
												<ChevronDown className="h-3 w-3" />
											) : (
												<ChevronRight className="h-3 w-3" />
											)}
										</CollapsibleTrigger>
										<CollapsibleContent className="mt-2">
											<div className="flex flex-col gap-3">
												{numSensors > 0 ? (
													Array.from({ length: numSensors }).map((_, index) => {
														const colorIndex = index % colorSettings.sensorColors.length;
														const color = colorSettings.sensorColors[colorIndex];
														return (
															// biome-ignore lint/suspicious/noArrayIndexKey:
															<div key={`color-picker-${index}`} className="flex items-center justify-between gap-2">
																<Input
																	type="text"
																	value={sensorLabels[index] ?? ""}
																	onChange={(e) => handleLabelChange(index, e.target.value)}
																	placeholder={`Sensor ${index + 1}`}
																	className="h-7 px-2 py-1"
																/>
																<Popover
																	open={openColorPickers[index]}
																	onOpenChange={(open) => {
																		const newOpenState = [...openColorPickers];
																		newOpenState[index] = open;
																		setOpenColorPickers(newOpenState);
																	}}
																>
																	<PopoverTrigger asChild>
																		<button
																			type="button"
																			className="size-7 rounded border cursor-pointer"
																			style={{ backgroundColor: color }}
																			aria-label={`Change color for ${sensorLabels[index] || `Sensor ${index + 1}`}`}
																		/>
																	</PopoverTrigger>
																	<PopoverContent className="w-auto p-3" side="right">
																		<HexColorPicker
																			color={color}
																			onChange={(newColor) => handleColorChange(index, newColor)}
																		/>
																		<Input
																			type="text"
																			value={color}
																			onChange={(e) => handleColorChange(index, e.target.value)}
																			className="mt-2"
																		/>
																	</PopoverContent>
																</Popover>
															</div>
														);
													})
												) : (
													<div className="text-xs text-center py-2">No sensors detected</div>
												)}
											</div>
										</CollapsibleContent>
									</Collapsible>

									{/* Bar Visualization */}
									<Collapsible
										open={isBarVisualsOpen}
										onOpenChange={setIsBarVisualsOpen}
										className="mt-2 border-t pt-2"
									>
										<CollapsibleTrigger className="flex items-center justify-between w-full">
											<span className="text-xs font-medium">Bar Visualization</span>
											{isBarVisualsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
										</CollapsibleTrigger>
										<CollapsibleContent className="mt-2">
											<div className="flex flex-col gap-2">
												<div className="flex items-center justify-between">
													<span className="text-xs">Show threshold value</span>
													<Switch
														checked={barSettings.showBarThresholdText}
														onCheckedChange={barSettings.setShowBarThresholdText}
														aria-label="Toggle threshold value display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show sensor value</span>
													<Switch
														checked={barSettings.showBarValueText}
														onCheckedChange={barSettings.setShowBarValueText}
														aria-label="Toggle sensor value display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Use threshold activation color</span>
													<Switch
														checked={barSettings.useThresholdColor}
														onCheckedChange={barSettings.setUseThresholdColor}
														aria-label="Toggle threshold color activation"
													/>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-xs">Threshold activation color</span>
													<Popover>
														<PopoverTrigger asChild>
															<button
																type="button"
																className="size-7 rounded border cursor-pointer"
																style={{ backgroundColor: colorSettings.thresholdColor }}
																aria-label="Change threshold activation color"
															/>
														</PopoverTrigger>
														<PopoverContent className="w-auto p-3" side="right">
															<HexColorPicker
																color={colorSettings.thresholdColor}
																onChange={colorSettings.setThresholdColor}
															/>
															<Input
																type="text"
																value={colorSettings.thresholdColor}
																onChange={(e) => colorSettings.setThresholdColor(e.target.value)}
																className="mt-2"
															/>
														</PopoverContent>
													</Popover>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Use single color for all bars</span>
													<Switch
														checked={barSettings.useSingleColor}
														onCheckedChange={barSettings.setUseSingleColor}
														aria-label="Toggle single color for all bars"
													/>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-xs">Bar color</span>
													<Popover>
														<PopoverTrigger asChild>
															<button
																type="button"
																className="size-7 rounded border cursor-pointer"
																style={{ backgroundColor: colorSettings.singleBarColor }}
																aria-label="Change single bar color"
															/>
														</PopoverTrigger>
														<PopoverContent className="w-auto p-3" side="right">
															<HexColorPicker
																color={colorSettings.singleBarColor}
																onChange={colorSettings.setSingleBarColor}
															/>
															<Input
																type="text"
																value={colorSettings.singleBarColor}
																onChange={(e) => colorSettings.setSingleBarColor(e.target.value)}
																className="mt-2"
															/>
														</PopoverContent>
													</Popover>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Bar gradient</span>
													<Switch
														checked={barSettings.useBarGradient}
														onCheckedChange={barSettings.setUseBarGradient}
														aria-label="Toggle bar gradient"
													/>
												</div>
											</div>
										</CollapsibleContent>
									</Collapsible>

									{/* Graph Visualization */}
									<Collapsible
										open={isGraphVisualsOpen}
										onOpenChange={setIsGraphVisualsOpen}
										className="mt-2 border-t pt-2"
									>
										<CollapsibleTrigger className="flex items-center justify-between w-full">
											<span className="text-xs font-medium">Graph Visualization</span>
											{isGraphVisualsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
										</CollapsibleTrigger>
										<CollapsibleContent className="mt-2">
											<div className="flex flex-col gap-2">
												<div className="flex flex-col gap-1">
													<span className="text-xs pb-0.5">Graph Window (ms)</span>
													<Input
														id="timeWindow"
														type="number"
														max="60000"
														step="100"
														value={graphSettings.timeWindow}
														onChange={handleTimeWindowChange}
														className="h-7 px-2 py-1"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show grid lines</span>
													<Switch
														checked={graphSettings.showGridLines}
														onCheckedChange={graphSettings.setShowGridLines}
														aria-label="Toggle grid lines display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show threshold lines</span>
													<Switch
														checked={graphSettings.showThresholdLines}
														onCheckedChange={graphSettings.setShowThresholdLines}
														aria-label="Toggle threshold lines display"
													/>
												</div>
												<div className="flex flex-col gap-1">
													<span className="text-xs pb-1">Threshold line opacity</span>
													<Slider
														value={[graphSettings.thresholdLineOpacity]}
														min={0}
														max={1}
														step={0.05}
														onValueChange={(value) => graphSettings.setThresholdLineOpacity(value[0])}
														aria-label="Adjust threshold line opacity"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show legend</span>
													<Switch
														checked={graphSettings.showLegend}
														onCheckedChange={graphSettings.setShowLegend}
														aria-label="Toggle legend display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show border</span>
													<Switch
														checked={graphSettings.showGraphBorder}
														onCheckedChange={graphSettings.setShowGraphBorder}
														aria-label="Toggle graph border display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show sensor activation</span>
													<Switch
														checked={graphSettings.showGraphActivation}
														onCheckedChange={graphSettings.setShowGraphActivation}
														aria-label="Toggle graph activation display"
													/>
												</div>
												<div className="flex items-center justify-between gap-2">
													<span className="text-xs">Activation color</span>
													<Popover>
														<PopoverTrigger asChild>
															<button
																type="button"
																className="size-7 rounded border cursor-pointer"
																style={{ backgroundColor: colorSettings.graphActivationColor }}
																aria-label="Change activation color"
															/>
														</PopoverTrigger>
														<PopoverContent className="w-auto p-3" side="right">
															<HexColorPicker
																color={colorSettings.graphActivationColor}
																onChange={colorSettings.setGraphActivationColor}
															/>
															<Input
																type="text"
																value={colorSettings.graphActivationColor}
																onChange={(e) => colorSettings.setGraphActivationColor(e.target.value)}
																className="mt-2"
															/>
														</PopoverContent>
													</Popover>
												</div>
											</div>
										</CollapsibleContent>
									</Collapsible>
								</CollapsibleContent>
							</Collapsible>

							<Collapsible
								open={isThresholdsOpen}
								onOpenChange={setIsThresholdsOpen}
								className="p-3 border rounded bg-white"
							>
								<CollapsibleTrigger className="flex items-center justify-between w-full">
									<span className="text-sm font-semibold">Thresholds</span>
									{isThresholdsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
								</CollapsibleTrigger>
								<CollapsibleContent className="mt-1">
									<div className="grid grid-cols-2 gap-x-2 gap-y-1">
										{thresholds.map((threshold, index) => (
											<div
												key={`threshold-sensor-${index}-${threshold}`}
												className="flex items-center justify-between text-xs"
											>
												<span>{sensorLabels[index] || `Sensor ${index + 1}`}:</span>
												<span className="font-mono">{threshold}</span>
											</div>
										))}
									</div>
								</CollapsibleContent>
							</Collapsible>
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

			{/* Create Profile Dialog */}
			<Dialog open={newProfileDialogOpen} onOpenChange={setNewProfileDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Profile</DialogTitle>
					</DialogHeader>
					<div className="py-2">
						<label htmlFor="new-profile-name" className="text-sm font-medium mb-1 block">
							Profile Name
						</label>
						<Input
							id="new-profile-name"
							placeholder="Enter profile name"
							value={profileNameInput}
							onChange={(e) => setProfileNameInput(e.target.value)}
							className="w-full"
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setNewProfileDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreateProfile} disabled={!profileNameInput.trim()}>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Rename Profile Dialog */}
			<Dialog open={renameProfileDialogOpen} onOpenChange={setRenameProfileDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rename Profile</DialogTitle>
					</DialogHeader>
					<div className="py-2">
						<label htmlFor="rename-profile-name" className="text-sm font-medium mb-1 block">
							New Profile Name
						</label>
						<Input
							id="rename-profile-name"
							placeholder="Enter profile name"
							value={profileNameInput}
							onChange={(e) => setProfileNameInput(e.target.value)}
							className="w-full"
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRenameProfileDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleRenameProfile} disabled={!profileNameInput.trim()}>
							Rename
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Profile Confirmation Dialog */}
			<Dialog open={deleteProfileDialogOpen} onOpenChange={setDeleteProfileDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Profile</DialogTitle>
					</DialogHeader>
					<div className="py-2">
						<p>Are you sure you want to delete the "{activeProfile?.name}" profile?</p>
						<p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteProfileDialogOpen(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteProfile}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Reset Profile Confirmation Dialog */}
			<Dialog open={resetProfileDialogOpen} onOpenChange={setResetProfileDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reset Profile</DialogTitle>
					</DialogHeader>
					<div className="py-2">
						<p>
							Are you sure you want to reset the "{activeProfile?.name}" profile to default values? Your thresholds and
							sensor labels will be kept.
						</p>
						<p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setResetProfileDialogOpen(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleResetProfile}>
							Reset
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
};

export default Dashboard;
