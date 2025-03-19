import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useProfileManager } from "~/lib/useProfileManager";
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
	} = useProfileManager();

	const [connectedITG, setConnectedITG] = useState<boolean>(false);
	const [timeWindow, setTimeWindow] = useState<number>(1000);
	const [thresholds, setThresholds] = useState<number[]>([]);
	const [sensorLabels, setSensorLabels] = useState<string[]>([]);
	const [sensorColors, setSensorColors] = useState<string[]>([
		"#ff0000", // Red
		"#ffd700", // Yellow
		"#b6f542", // Green
		"#00ffff", // Cyan
		"#0000ff", // Blue
		"#ff00ff", // Magenta
	]);

	// Profile management states
	const [profileComboboxOpen, setProfileComboboxOpen] = useState(false);
	const [newProfileDialogOpen, setNewProfileDialogOpen] = useState(false);
	const [renameProfileDialogOpen, setRenameProfileDialogOpen] = useState(false);
	const [deleteProfileDialogOpen, setDeleteProfileDialogOpen] = useState(false);
	const [profileNameInput, setProfileNameInput] = useState("");
	const [isProfilesOpen, setIsProfilesOpen] = useState(true);

	// Track which color picker popovers are open
	const [openColorPickers, setOpenColorPickers] = useState<boolean[]>([]);

	// Bar visualization options
	const [showBarThresholdText, setShowBarThresholdText] = useState<boolean>(true);
	const [showBarValueText, setShowBarValueText] = useState<boolean>(true);
	const [thresholdColor, setThresholdColor] = useState<string>("#00ff00");
	const [useThresholdColor, setUseThresholdColor] = useState<boolean>(true);
	const [useSingleColor, setUseSingleColor] = useState<boolean>(true);
	const [singleBarColor, setSingleBarColor] = useState<string>("#0000ff");
	const [useBarGradient, setUseBarGradient] = useState<boolean>(true);

	// Time series graph options
	const [showGridLines, setShowGridLines] = useState<boolean>(true);
	const [showThresholdLines, setShowThresholdLines] = useState<boolean>(true);
	const [thresholdLineOpacity, setThresholdLineOpacity] = useState<number>(0.5);
	const [showLegend, setShowLegend] = useState<boolean>(true);
	const [showGraphBorder, setShowGraphBorder] = useState<boolean>(true);

	// Collapsible state for sections
	const [isVisualsOpen, setIsVisualsOpen] = useState<boolean>(true);
	const [isGeneralVisualsOpen, setIsGeneralVisualsOpen] = useState<boolean>(true);
	const [isBarVisualsOpen, setIsBarVisualsOpen] = useState<boolean>(true);
	const [isGraphVisualsOpen, setIsGraphVisualsOpen] = useState<boolean>(true);
	const [isLastResultOpen, setIsLastResultOpen] = useState<boolean>(true);
	const [isThresholdsOpen, setIsThresholdsOpen] = useState<boolean>(true);

	// Load active profile data into state
	// biome-ignore lint/correctness/useExhaustiveDependencies:
	useEffect(() => {
		if (activeProfile) {
			setSensorColors(activeProfile.sensorColors);
			setShowBarThresholdText(activeProfile.showBarThresholdText);
			setShowBarValueText(activeProfile.showBarValueText);
			setThresholdColor(activeProfile.thresholdColor);
			setUseThresholdColor(activeProfile.useThresholdColor);
			setUseSingleColor(activeProfile.useSingleColor);
			setSingleBarColor(activeProfile.singleBarColor);
			setUseBarGradient(activeProfile.useBarGradient);
			setShowGridLines(activeProfile.showGridLines);
			setShowThresholdLines(activeProfile.showThresholdLines);
			setThresholdLineOpacity(activeProfile.thresholdLineOpacity);
			setShowLegend(activeProfile.showLegend);
			setShowGraphBorder(activeProfile.showGraphBorder);
			setTimeWindow(activeProfile.timeWindow);
			setThresholds(activeProfile.thresholds.length > 0 ? activeProfile.thresholds : thresholds);
			setSensorLabels(activeProfile.sensorLabels.length > 0 ? activeProfile.sensorLabels : sensorLabels);
		}
	}, [activeProfileId]);

	const updateProfileVisualSettings = useCallback(() => {
		if (!activeProfileId) return;

		updateProfile(activeProfileId, {
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
			timeWindow,
		});
	}, [
		activeProfileId,
		updateProfile,
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
		timeWindow,
	]);

	// Update profile when visual settings change
	// biome-ignore lint/correctness/useExhaustiveDependencies: called on every change of visual settings
	useEffect(() => {
		if (activeProfileId) updateProfileVisualSettings();
	}, [
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
		timeWindow,
		activeProfileId,
		updateProfileVisualSettings,
	]);

	// Handle creating a new profile
	const handleCreateProfile = useCallback(async () => {
		if (!profileNameInput.trim()) return;

		await createProfile(profileNameInput, activeProfileId || undefined);
		setProfileNameInput("");
		setNewProfileDialogOpen(false);
	}, [profileNameInput, createProfile, activeProfileId]);

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

	// Initialize thresholds and labels when we first get sensor data
	useEffect(() => {
		if (latestData && thresholds.length !== latestData.values.length)
			setThresholds(Array(latestData.values.length).fill(512));

		if (latestData && sensorLabels.length !== latestData.values.length) {
			setSensorLabels(
				Array(latestData.values.length)
					.fill("")
					.map((_, i) => `Sensor ${i + 1}`),
			);
		}

		// Initialize color picker open state
		if (latestData && openColorPickers.length !== latestData.values.length)
			setOpenColorPickers(Array(latestData.values.length).fill(false));
	}, [latestData, thresholds.length, sensorLabels.length, openColorPickers.length]);

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
								<Button
									variant="outline"
									size="sm"
									className="flex-1"
									onClick={() => {
										setIsLastResultOpen(false);
										setIsThresholdsOpen(false);
										setIsVisualsOpen(false);
										setIsProfilesOpen(false);
									}}
								>
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
															value={sensorLabels[index] || `Sensor ${index + 1}`}
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
								{/* Bar Visualizations */}
								<div className="p-1 border rounded-lg bg-white shadow-sm flex-shrink-0 h-[25rem]">
									<div className="flex justify-around gap-4 flex-wrap h-full">{sensorBars}</div>
								</div>

								{/* Time Series Graph */}
								<div className="p-1 border rounded-lg bg-white shadow-sm mt-1 flex-grow min-h-0">
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
		</main>
	);
};

export default Dashboard;
