import { useState, useEffect, useCallback, useMemo, type SetStateAction, type Dispatch } from "react";
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
import { useProfileManager, DEFAULT_PROFILE, type ProfileData } from "~/lib/useProfileManager";
import { cn } from "~/lib/utils";

const Dashboard = () => {
	const { isSupported, connect, disconnect, connected, connectionError, latestData, requestsPerSecond, sendText } =
		useSerialPort();

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
	const [timeWindow, setTimeWindow] = useState<number>(DEFAULT_PROFILE.timeWindow);
	const [thresholds, setThresholds] = useState<number[]>([]);
	const [sensorLabels, setSensorLabels] = useState<string[]>([]);
	const [sensorColors, setSensorColors] = useState<string[]>(DEFAULT_PROFILE.sensorColors);

	// Profile management states
	const [profileComboboxOpen, setProfileComboboxOpen] = useState(false);
	const [newProfileDialogOpen, setNewProfileDialogOpen] = useState(false);
	const [renameProfileDialogOpen, setRenameProfileDialogOpen] = useState(false);
	const [deleteProfileDialogOpen, setDeleteProfileDialogOpen] = useState(false);
	const [resetProfileDialogOpen, setResetProfileDialogOpen] = useState(false);
	const [profileNameInput, setProfileNameInput] = useState("");
	const [isProfilesOpen, setIsProfilesOpen] = useState(true);

	// General settings
	const [showHeartrateTracker, setShowHeartrateTracker] = useState<boolean>(DEFAULT_PROFILE.showHeartrateTracker);
	const [lockThresholds, setLockThresholds] = useState<boolean>(DEFAULT_PROFILE.lockThresholds);
	const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState<boolean>(true);

	// Track which color picker popovers are open
	const [openColorPickers, setOpenColorPickers] = useState<boolean[]>([]);

	// Bar visualization options
	const [showBarThresholdText, setShowBarThresholdText] = useState<boolean>(DEFAULT_PROFILE.showBarThresholdText);
	const [showBarValueText, setShowBarValueText] = useState<boolean>(DEFAULT_PROFILE.showBarValueText);
	const [thresholdColor, setThresholdColor] = useState<string>(DEFAULT_PROFILE.thresholdColor);
	const [useThresholdColor, setUseThresholdColor] = useState<boolean>(DEFAULT_PROFILE.useThresholdColor);
	const [useSingleColor, setUseSingleColor] = useState<boolean>(DEFAULT_PROFILE.useSingleColor);
	const [singleBarColor, setSingleBarColor] = useState<string>(DEFAULT_PROFILE.singleBarColor);
	const [useBarGradient, setUseBarGradient] = useState<boolean>(DEFAULT_PROFILE.useBarGradient);

	// Time series graph options
	const [showGridLines, setShowGridLines] = useState<boolean>(DEFAULT_PROFILE.showGridLines);
	const [showThresholdLines, setShowThresholdLines] = useState<boolean>(DEFAULT_PROFILE.showThresholdLines);
	const [thresholdLineOpacity, setThresholdLineOpacity] = useState<number>(DEFAULT_PROFILE.thresholdLineOpacity);
	const [showLegend, setShowLegend] = useState<boolean>(DEFAULT_PROFILE.showLegend);
	const [showGraphBorder, setShowGraphBorder] = useState<boolean>(DEFAULT_PROFILE.showGraphBorder);
	const [showGraphActivation, setShowGraphActivation] = useState<boolean>(DEFAULT_PROFILE.showGraphActivation);
	const [graphActivationColor, setGraphActivationColor] = useState<string>(DEFAULT_PROFILE.graphActivationColor);

	// Collapsible state for sections
	const [isVisualsOpen, setIsVisualsOpen] = useState<boolean>(true);
	const [isGeneralVisualsOpen, setIsGeneralVisualsOpen] = useState<boolean>(true);
	const [isBarVisualsOpen, setIsBarVisualsOpen] = useState<boolean>(true);
	const [isGraphVisualsOpen, setIsGraphVisualsOpen] = useState<boolean>(true);
	const [isLastResultOpen, setIsLastResultOpen] = useState<boolean>(true);
	const [isThresholdsOpen, setIsThresholdsOpen] = useState<boolean>(true);

	// Function to send all thresholds to the microcontroller
	// biome-ignore lint/correctness/useExhaustiveDependencies: do not need to call on every threshold change
	const sendAllThresholds = useCallback(() => {
		if (!connected || !thresholds.length) return;

		// Send each threshold to the microcontroller
		thresholds.forEach((value, index) => {
			const message = `${index} ${value}\n`;
			sendText(message);
		});
	}, [connected, sendText]);

	// Send all thresholds when connection is established
	useEffect(() => {
		if (connected) sendAllThresholds();
	}, [connected, sendAllThresholds]);

	// Send all thresholds when profile changes
	useEffect(() => {
		if (activeProfileId && connected) sendAllThresholds();
	}, [activeProfileId, connected, sendAllThresholds]);

	// Synchronize UI state with profile data
	const syncUIStateWithProfile = useCallback((profile: ProfileData) => {
		if (!profile) return;

		setSensorColors(profile.sensorColors);
		setShowBarThresholdText(profile.showBarThresholdText);
		setShowBarValueText(profile.showBarValueText);
		setThresholdColor(profile.thresholdColor);
		setUseThresholdColor(profile.useThresholdColor);
		setUseSingleColor(profile.useSingleColor);
		setSingleBarColor(profile.singleBarColor);
		setUseBarGradient(profile.useBarGradient);
		setShowGridLines(profile.showGridLines);
		setShowThresholdLines(profile.showThresholdLines);
		setThresholdLineOpacity(profile.thresholdLineOpacity);
		setShowLegend(profile.showLegend);
		setShowGraphBorder(profile.showGraphBorder);
		setShowGraphActivation(profile.showGraphActivation);
		setGraphActivationColor(profile.graphActivationColor);
		setTimeWindow(profile.timeWindow);
		setShowHeartrateTracker(profile.showHeartrateTracker);
		setLockThresholds(profile.lockThresholds);

		// Only update thresholds and sensor labels if they exist in the profile
		if (profile.thresholds.length > 0) setThresholds(profile.thresholds);
		if (profile.sensorLabels.length > 0) setSensorLabels(profile.sensorLabels);
	}, []);

	// Load active profile data into state
	// biome-ignore lint/correctness/useExhaustiveDependencies:
	useEffect(() => {
		if (activeProfile) syncUIStateWithProfile(activeProfile);
	}, [activeProfileId, syncUIStateWithProfile]);

	// Get all visual settings from UI state
	const getVisualSettingsFromUIState = useCallback(
		() => ({
			sensorColors,
			showBarThresholdText,
			showBarValueText,
			thresholdColor,
			useThresholdColor,
			useSingleColor,
			singleBarColor,
			useBarGradient,
			showGridLines,
			showThresholdLines,
			thresholdLineOpacity,
			showLegend,
			showGraphBorder,
			showGraphActivation,
			graphActivationColor,
			timeWindow,
			showHeartrateTracker,
			lockThresholds,
		}),
		[
			sensorColors,
			showBarThresholdText,
			showBarValueText,
			thresholdColor,
			useThresholdColor,
			useSingleColor,
			singleBarColor,
			useBarGradient,
			showGridLines,
			showThresholdLines,
			thresholdLineOpacity,
			showLegend,
			showGraphBorder,
			showGraphActivation,
			graphActivationColor,
			timeWindow,
			showHeartrateTracker,
			lockThresholds,
		],
	);

	const updateProfileVisualSettings = useCallback(() => {
		if (!activeProfileId) return;
		updateProfile(activeProfileId, getVisualSettingsFromUIState());
	}, [activeProfileId, updateProfile, getVisualSettingsFromUIState]);

	// Update profile when visual settings change
	useEffect(() => {
		if (activeProfileId) updateProfileVisualSettings();
	}, [activeProfileId, updateProfileVisualSettings]);

	// Handle creating a new profile
	const handleCreateProfile = useCallback(async () => {
		if (!profileNameInput.trim()) return;

		const newProfile = await createProfile(profileNameInput, activeProfileId || undefined);
		setProfileNameInput("");
		setNewProfileDialogOpen(false);
		if (newProfile?.id) setActiveProfileById(newProfile.id);
	}, [profileNameInput, createProfile, activeProfileId, setActiveProfileById]);

	// Handle renaming the active profile
	const handleRenameProfile = useCallback(async () => {
		if (!activeProfileId || !profileNameInput.trim()) return;

		await updateProfile(activeProfileId, { name: profileNameInput });
		setProfileNameInput("");
		setRenameProfileDialogOpen(false);
	}, [activeProfileId, profileNameInput, updateProfile]);

	// Handle deleting the active profile
	const handleDeleteProfile = useCallback(async () => {
		if (!activeProfileId) return;

		await deleteProfile(activeProfileId);
		setDeleteProfileDialogOpen(false);
	}, [activeProfileId, deleteProfile]);

	// Handle resetting the active profile to default values
	const handleResetProfile = useCallback(async () => {
		if (!activeProfileId) return;

		const resetProfile = await resetProfileToDefaults(activeProfileId);
		if (resetProfile) syncUIStateWithProfile(resetProfile);

		setResetProfileDialogOpen(false);
	}, [activeProfileId, resetProfileToDefaults, syncUIStateWithProfile]);

	// Initialize defaults when we first get sensor data
	// biome-ignore lint/correctness/useExhaustiveDependencies:
	useEffect(() => {
		if (!latestData) return;

		// Initialize missing thresholds with default value
		if (thresholds.length !== latestData.values.length) {
			const newThresholds = Array(latestData.values.length).fill(512);
			setThresholds(newThresholds);

			if (activeProfileId) updateThresholds(newThresholds);
		}

		// Initialize missing sensor labels
		if (sensorLabels.length !== latestData.values.length) {
			const newLabels = Array(latestData.values.length)
				.fill("")
				.map((_, i) => `Sensor ${i + 1}`);

			setSensorLabels(newLabels);

			if (activeProfileId) updateSensorLabels(newLabels);
		}

		// Initialize color picker open state
		if (openColorPickers.length !== latestData.values.length)
			setOpenColorPickers(Array(latestData.values.length).fill(false));
	}, [
		thresholds.length,
		sensorLabels.length,
		openColorPickers.length,
		activeProfileId,
		updateThresholds,
		updateSensorLabels,
	]);

	const handleThresholdChange = useCallback(
		(index: number, value: number) => {
			setThresholds((prev) => {
				const newThresholds = [...prev];
				newThresholds[index] = value;

				if (activeProfileId) updateThresholds(newThresholds);

				return newThresholds;
			});

			// Send threshold update to serial port if connected
			if (connected) {
				const message = `${index} ${value}\n`;
				sendText(message);
			}
		},
		[connected, sendText, activeProfileId, updateThresholds],
	);

	const handleLabelChange = useCallback(
		(index: number, value: string) => {
			setSensorLabels((prev) => {
				const newLabels = [...prev];
				newLabels[index] = value;

				if (activeProfileId) updateSensorLabels(newLabels);

				return newLabels;
			});
		},
		[activeProfileId, updateSensorLabels],
	);

	const handleConnectionToggle = useCallback(async () => {
		if (!isSupported) return;

		if (connected) {
			await disconnect();
		} else {
			await connect();
		}
	}, [isSupported, connected, connect, disconnect]);

	const handleColorChange = useCallback((index: number, color: string) => {
		setSensorColors((prev) => {
			const newColors = [...prev];
			newColors[index] = color;
			return newColors;
		});
	}, []);

	const handleTimeWindowChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = Number.parseInt(e.target.value, 10);
		setTimeWindow(Number.isNaN(value) || value < 0 ? 0 : value);
	}, []);

	// Collapsible sections management
	const collapsibleSections: Record<string, [boolean, Dispatch<SetStateAction<boolean>>]> = {
		profiles: [isProfilesOpen, setIsProfilesOpen],
		generalSettings: [isGeneralSettingsOpen, setIsGeneralSettingsOpen],
		visuals: [isVisualsOpen, setIsVisualsOpen],
		lastResult: [isLastResultOpen, setIsLastResultOpen],
		thresholds: [isThresholdsOpen, setIsThresholdsOpen],
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies:
	const minimizeAllSections = useCallback(() => {
		for (const [_, setter] of Object.values(collapsibleSections)) setter(false);
	}, []);

	// Memoize the sensor bars to prevent unnecessary re-renders (will be unnecessary once react compiler works...)
	const sensorBars = useMemo(() => {
		if (!latestData) return null;

		return latestData.values.map((value, index) => (
			<SensorBar
				// biome-ignore lint/suspicious/noArrayIndexKey:
				key={`sensor-${index}`}
				value={value}
				index={index}
				threshold={thresholds[index] || 512}
				onThresholdChange={handleThresholdChange}
				label={sensorLabels[index] || `Sensor ${index + 1}`}
				color={useSingleColor ? singleBarColor : sensorColors[index % sensorColors.length] || "#ff0000"}
				showThresholdText={showBarThresholdText}
				showValueText={showBarValueText}
				thresholdColor={thresholdColor}
				useThresholdColor={useThresholdColor}
				useGradient={useBarGradient}
				isLocked={lockThresholds}
			/>
		));
	}, [
		latestData,
		thresholds,
		handleThresholdChange,
		sensorLabels,
		showBarThresholdText,
		showBarValueText,
		sensorColors,
		thresholdColor,
		useThresholdColor,
		useSingleColor,
		singleBarColor,
		useBarGradient,
		lockThresholds,
	]);

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

								{/* not yet implemented */}
								<div className="font-medium">
									ITG:{" "}
									<span className={`${connectedITG ? "text-green-500" : "text-destructive"}`}>
										{connectedITG ? " Connected" : " Disconnected"}
									</span>
								</div>
							</div>

							{connectionError && (
								<div className="text-sm text-destructive">Error connecting to device: {connectionError}</div>
							)}

							<div className="p-3 border rounded bg-white">
								<div className="flex items-center justify-between">
									<span className="text-xs text-gray-600">Requests/sec:</span>
									<span className="text-sm font-medium">{requestsPerSecond}</span>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" className="flex-1" onClick={minimizeAllSections}>
									Minimize all toolbars
								</Button>
								<TooltipProvider>
									<Tooltip delayDuration={500}>
										<TooltipTrigger asChild>
											<div className="flex items-center justify-center h-8 w-8 rounded-md border-input hover:text-accent-foreground">
												<HelpCircle className="size-4 text-muted-foreground" />
											</div>
										</TooltipTrigger>
										<TooltipContent>
											<p className="max-w-3xs">
												Minimizing all of the toolbars in the sidebar will improve the number of possible requests/sec
												and results in smoother visual response.
											</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
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
											<span className="text-xs">Show heartrate tracker</span>
											<Switch
												checked={showHeartrateTracker}
												onCheckedChange={setShowHeartrateTracker}
												aria-label="Toggle heartrate tracker display"
											/>
										</div>
										<div className="flex items-center justify-between">
											<span className="text-xs">Lock thresholds</span>
											<Switch
												checked={lockThresholds}
												onCheckedChange={setLockThresholds}
												aria-label="Toggle threshold locking"
											/>
										</div>
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
												{sensorColors.map((color, index) => (
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
												))}
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
														checked={showBarThresholdText}
														onCheckedChange={setShowBarThresholdText}
														aria-label="Toggle threshold value display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show sensor value</span>
													<Switch
														checked={showBarValueText}
														onCheckedChange={setShowBarValueText}
														aria-label="Toggle sensor value display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Use threshold activation color</span>
													<Switch
														checked={useThresholdColor}
														onCheckedChange={setUseThresholdColor}
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
																style={{ backgroundColor: thresholdColor }}
																aria-label="Change threshold activation color"
															/>
														</PopoverTrigger>
														<PopoverContent className="w-auto p-3" side="right">
															<HexColorPicker color={thresholdColor} onChange={setThresholdColor} />
															<Input
																type="text"
																value={thresholdColor}
																onChange={(e) => setThresholdColor(e.target.value)}
																className="mt-2"
															/>
														</PopoverContent>
													</Popover>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Use single color for all bars</span>
													<Switch
														checked={useSingleColor}
														onCheckedChange={setUseSingleColor}
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
																style={{ backgroundColor: singleBarColor }}
																aria-label="Change single bar color"
															/>
														</PopoverTrigger>
														<PopoverContent className="w-auto p-3" side="right">
															<HexColorPicker color={singleBarColor} onChange={setSingleBarColor} />
															<Input
																type="text"
																value={singleBarColor}
																onChange={(e) => setSingleBarColor(e.target.value)}
																className="mt-2"
															/>
														</PopoverContent>
													</Popover>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Bar gradient</span>
													<Switch
														checked={useBarGradient}
														onCheckedChange={setUseBarGradient}
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
														value={timeWindow}
														onChange={handleTimeWindowChange}
														className="h-7 px-2 py-1"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show grid lines</span>
													<Switch
														checked={showGridLines}
														onCheckedChange={setShowGridLines}
														aria-label="Toggle grid lines display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show threshold lines</span>
													<Switch
														checked={showThresholdLines}
														onCheckedChange={setShowThresholdLines}
														aria-label="Toggle threshold lines display"
													/>
												</div>
												<div className="flex flex-col gap-1">
													<span className="text-xs pb-1">Threshold line opacity</span>
													<Slider
														value={[thresholdLineOpacity]}
														min={0}
														max={1}
														step={0.05}
														onValueChange={(value) => setThresholdLineOpacity(value[0])}
														aria-label="Adjust threshold line opacity"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show legend</span>
													<Switch
														checked={showLegend}
														onCheckedChange={setShowLegend}
														aria-label="Toggle legend display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show border</span>
													<Switch
														checked={showGraphBorder}
														onCheckedChange={setShowGraphBorder}
														aria-label="Toggle graph border display"
													/>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-xs">Show sensor activation</span>
													<Switch
														checked={showGraphActivation}
														onCheckedChange={setShowGraphActivation}
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
																style={{ backgroundColor: graphActivationColor }}
																aria-label="Change activation color"
															/>
														</PopoverTrigger>
														<PopoverContent className="w-auto p-3" side="right">
															<HexColorPicker color={graphActivationColor} onChange={setGraphActivationColor} />
															<Input
																type="text"
																value={graphActivationColor}
																onChange={(e) => setGraphActivationColor(e.target.value)}
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

							{latestData && (
								<Collapsible
									open={isLastResultOpen}
									onOpenChange={setIsLastResultOpen}
									className="p-3 border rounded bg-white"
								>
									<CollapsibleTrigger className="flex items-center justify-between w-full">
										<span className="text-sm font-semibold">Last data</span>
										{isLastResultOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
									</CollapsibleTrigger>
									<CollapsibleContent className="mt-1">
										<div className="text-xs font-mono overflow-x-auto whitespace-nowrap">{latestData.rawData}</div>
									</CollapsibleContent>
								</Collapsible>
							)}
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
									{showHeartrateTracker && (
										<div className="p-4 border rounded-lg bg-white shadow-sm aspect-square h-full flex flex-col items-center justify-center gap-2 min-w-64">
											<Heart className="size-16 text-muted-foreground" />
											<p className="text-muted-foreground text-center">Heartrate tracker not connected</p>
										</div>
									)}
								</div>

								{/* Time Series Graph */}
								<div className="p-1 border rounded-lg bg-white shadow-sm mt-2 flex-grow min-h-0">
									<div className="h-full">
										<TimeSeriesGraph
											latestData={latestData}
											timeWindow={timeWindow}
											thresholds={thresholds}
											sensorLabels={sensorLabels}
											sensorColors={sensorColors}
											showGridLines={showGridLines}
											showThresholdLines={showThresholdLines}
											thresholdLineOpacity={thresholdLineOpacity}
											showLegend={showLegend}
											showBorder={showGraphBorder}
											showActivation={showGraphActivation}
											activationColor={graphActivationColor}
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
