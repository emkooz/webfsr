import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Pencil, Plus, Trash2, Undo } from "lucide-react";
import { type ChangeEvent, type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { useProfileManager } from "~/lib/useProfileManager";
import { cn } from "~/lib/utils";
import { useBarVisualizationSettings, useColorSettings, useGraphVisualizationSettings } from "~/store/settingsStore";

// annoying but needed to prevent re-renders of some components with specific callbacks
function useStableCallback<Args extends unknown[]>(callback: (...args: Args) => void): (...args: Args) => void {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	const stableCallbackRef = useRef((...args: Args) => {
		callbackRef.current(...args);
	});

	return stableCallbackRef.current;
}

export type VisualSettingsSectionProps = {
	numSensors: number;
	sensorLabels: string[];
	onLabelChange: (index: number, value: string) => void;
	openColorPickers: boolean[];
	setOpenColorPickers: Dispatch<SetStateAction<boolean[]>>;
};

export function VisualSettingsSection({
	numSensors,
	sensorLabels,
	onLabelChange,
	openColorPickers,
	setOpenColorPickers,
}: VisualSettingsSectionProps) {
	const colorSettings = useColorSettings();
	const barSettings = useBarVisualizationSettings();
	const graphSettings = useGraphVisualizationSettings();
	const [isVisualsOpen, setIsVisualsOpen] = useState<boolean>(true);
	const [isGeneralVisualsOpen, setIsGeneralVisualsOpen] = useState<boolean>(true);
	const [isBarVisualsOpen, setIsBarVisualsOpen] = useState<boolean>(true);
	const [isGraphVisualsOpen, setIsGraphVisualsOpen] = useState<boolean>(true);

	const handleColorChange = (index: number, color: string) => {
		const newColors = [...colorSettings.sensorColors];
		newColors[index] = color;
		colorSettings.setSensorColors(newColors);
	};

	const handleTimeWindowChange = (e: ChangeEvent<HTMLInputElement>) => {
		const value = Number.parseInt(e.target.value, 10);
		graphSettings.setTimeWindow(Number.isNaN(value) || value < 0 ? 0 : value);
	};

	return (
		<Collapsible open={isVisualsOpen} onOpenChange={setIsVisualsOpen} className="p-3 border rounded bg-white">
			<CollapsibleTrigger className="flex items-center justify-between w-full">
				<span className="text-sm font-semibold">Visual Settings</span>
				{isVisualsOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
			</CollapsibleTrigger>
			<CollapsibleContent className="mt-1">
				{/* General Visuals */}
				<Collapsible open={isGeneralVisualsOpen} onOpenChange={setIsGeneralVisualsOpen} className="mt-2 border-t pt-2">
					<CollapsibleTrigger className="flex items-center justify-between w-full">
						<span className="text-xs font-medium">General</span>
						{isGeneralVisualsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
												onChange={(e) => onLabelChange(index, e.target.value)}
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
													<HexColorPicker color={color} onChange={(newColor) => handleColorChange(index, newColor)} />
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
				<Collapsible open={isBarVisualsOpen} onOpenChange={setIsBarVisualsOpen} className="mt-2 border-t pt-2">
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
										<HexColorPicker color={colorSettings.thresholdColor} onChange={colorSettings.setThresholdColor} />
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
										<HexColorPicker color={colorSettings.singleBarColor} onChange={colorSettings.setSingleBarColor} />
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
				<Collapsible open={isGraphVisualsOpen} onOpenChange={setIsGraphVisualsOpen} className="mt-2 border-t pt-2">
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
	);
}

export function ProfilesSection() {
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
	} = useProfileManager();

	const [isOpen, setIsOpen] = useState(true);
	const [profileComboboxOpen, setProfileComboboxOpen] = useState(false);
	const [newProfileDialogOpen, setNewProfileDialogOpen] = useState(false);
	const [renameProfileDialogOpen, setRenameProfileDialogOpen] = useState(false);
	const [deleteProfileDialogOpen, setDeleteProfileDialogOpen] = useState(false);
	const [resetProfileDialogOpen, setResetProfileDialogOpen] = useState(false);
	const [profileNameInput, setProfileNameInput] = useState("");

	const onSelectProfile = useStableCallback((id: number | null) => {
		if (id) setActiveProfileById(id);
		setProfileComboboxOpen(false);
	});

	const onOpenCreate = useStableCallback(() => {
		setProfileNameInput("");
		setNewProfileDialogOpen(true);
	});

	const onOpenRename = useStableCallback(() => {
		if (activeProfile) {
			setProfileNameInput(activeProfile.name);
			setRenameProfileDialogOpen(true);
		}
	});

	const onOpenDelete = useStableCallback(() => setDeleteProfileDialogOpen(true));
	const onOpenReset = useStableCallback(() => setResetProfileDialogOpen(true));

	const handleCreateProfile = useStableCallback(async () => {
		if (!profileNameInput.trim()) return;
		const newProfile = await createProfile(profileNameInput, activeProfileId || undefined);
		setProfileNameInput("");
		setNewProfileDialogOpen(false);
		if (newProfile?.id) setActiveProfileById(newProfile.id);
	});

	const handleRenameProfile = useStableCallback(async () => {
		if (!activeProfileId || !profileNameInput.trim()) return;
		await updateProfile(activeProfileId, { name: profileNameInput });
		setProfileNameInput("");
		setRenameProfileDialogOpen(false);
	});

	const handleDeleteProfile = useStableCallback(async () => {
		if (!activeProfileId) return;
		await deleteProfile(activeProfileId);
		setDeleteProfileDialogOpen(false);
	});

	const handleResetProfile = useStableCallback(async () => {
		if (!activeProfileId) return;
		await resetProfileToDefaults(activeProfileId);
		setResetProfileDialogOpen(false);
	});

	return (
		<>
			<Collapsible open={isOpen} onOpenChange={setIsOpen} className="p-3 border rounded bg-white">
				<CollapsibleTrigger className="flex items-center justify-between w-full">
					<span className="text-sm font-semibold">Profiles</span>
					{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
				</CollapsibleTrigger>
				<CollapsibleContent className="mt-3">
					{isProfileLoading ? (
						<div className="text-xs text-center py-2">Loading profiles...</div>
					) : (
						<>
							<Popover open={profileComboboxOpen} onOpenChange={setProfileComboboxOpen}>
								<PopoverTrigger asChild>
									<Button variant="outline" aria-expanded={profileComboboxOpen} className="w-full justify-between">
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
														onSelect={() => onSelectProfile(profile.id || null)}
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
								<Button size="sm" variant="outline" className="flex-1" onClick={onOpenCreate}>
									<Plus className="size-4" />
								</Button>
								<Button size="sm" variant="outline" className="flex-1" disabled={!activeProfile} onClick={onOpenRename}>
									<Pencil className="size-4" />
								</Button>
								<Button size="sm" variant="outline" className="flex-1" disabled={!activeProfile} onClick={onOpenReset}>
									<Undo className="size-4" />
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="flex-1"
									disabled={!activeProfile || profiles.length <= 1}
									onClick={onOpenDelete}
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						</>
					)}
				</CollapsibleContent>
			</Collapsible>

			{/* Dialogs */}
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
		</>
	);
}

export type GeneralSettingsSectionProps = {
	generalSettings: {
		lockThresholds: boolean;
		setLockThresholds: (value: boolean) => void;
		pollingRate: number;
		setPollingRate: (value: number) => void;
		useUnthrottledPolling: boolean;
		setUseUnthrottledPolling: (value: boolean) => void;
		obsSendRate: number;
		setObsSendRate: (value: number) => void;
	};
};

export function GeneralSettingsSection({ generalSettings }: GeneralSettingsSectionProps) {
	const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState<boolean>(true);

	return (
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
					<div className="flex items-center justify-between">
						<span className="text-xs">Unthrottled polling</span>
						<Switch
							checked={generalSettings.useUnthrottledPolling}
							onCheckedChange={generalSettings.setUseUnthrottledPolling}
							aria-label="Toggle unthrottled polling"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-xs pb-1">
							Polling rate (polls/sec):{" "}
							{generalSettings.useUnthrottledPolling ? "unlimited" : generalSettings.pollingRate}
						</span>
						<Slider
							value={[generalSettings.pollingRate]}
							min={1}
							max={1000}
							step={1}
							onValueChange={(value) => generalSettings.setPollingRate(value[0])}
							disabled={generalSettings.useUnthrottledPolling}
							aria-label="Adjust polling rate"
						/>
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export type HeartRateMonitorSectionProps = {
	heartrateSettings: {
		showHeartrateMonitor: boolean;
		setShowHeartrateMonitor: (value: boolean) => void;
		animateHeartbeat: boolean;
		setAnimateHeartbeat: (value: boolean) => void;
		verticalAlignHeartrate: boolean;
		setVerticalAlignHeartrate: (value: boolean) => void;
		fillHeartIcon: boolean;
		setFillHeartIcon: (value: boolean) => void;
		showBpmText: boolean;
		setShowBpmText: (value: boolean) => void;
	};
	onToggle: () => void;
	connectedHR: boolean;
	isBluetoothSupported: boolean;
	heartrateDevice?: BluetoothDevice | null;
	heartrateData?: { heartrate: number } | null;
};

export function HeartRateMonitorSection({
	heartrateSettings,
	onToggle,
	connectedHR,
	isBluetoothSupported,
	heartrateDevice,
	heartrateData,
}: HeartRateMonitorSectionProps) {
	const [isHeartrateOpen, setIsHeartrateOpen] = useState<boolean>(true);

	return (
		<Collapsible open={isHeartrateOpen} onOpenChange={setIsHeartrateOpen} className="p-3 border rounded bg-white">
			<CollapsibleTrigger className="flex items-center justify-between w-full">
				<span className="text-sm font-semibold">Heartrate Monitor</span>
				{isHeartrateOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
			</CollapsibleTrigger>
			<CollapsibleContent className="mt-3">
				<div className="flex flex-col gap-3">
					<Button onClick={onToggle} className="w-full" disabled={!isBluetoothSupported}>
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
	);
}

export type OBSSectionProps = {
	obsConnected: boolean;
	obsConnecting: boolean;
	obsError: string | null;
	obsSendRate: number;
	setObsSendRate: (v: number) => void;
	onToggle: (pwd: string) => void;
};

export function OBSSection({
	obsConnected,
	obsConnecting,
	obsError,
	obsSendRate,
	setObsSendRate,
	onToggle,
}: OBSSectionProps) {
	const [isOpen, setIsOpen] = useState<boolean>(true);
	const { activeProfile, activeProfileId, updateProfile } = useProfileManager();
	const [password, setPassword] = useState<string>(activeProfile?.obsPassword ?? "");

	useEffect(() => {
		setPassword(activeProfile?.obsPassword ?? "");
	}, [activeProfile?.obsPassword]);

	const onPwdChange = (e: ChangeEvent<HTMLInputElement>) => {
		const pwd = e.target.value;
		setPassword(pwd);
		if (activeProfileId !== null) updateProfile(activeProfileId, { obsPassword: pwd });
	};

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen} className="p-3 border rounded bg-white">
			<CollapsibleTrigger className="flex items-center justify-between w-full">
				<span className="text-sm font-semibold">OBS</span>
				{isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
			</CollapsibleTrigger>
			<CollapsibleContent className="mt-3">
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<span className="text-xs">Status</span>
						<span
							className={`text-xs font-medium ${obsConnected ? "text-green-600" : obsConnecting ? "text-amber-600" : "text-destructive"}`}
						>
							{obsConnecting ? "Connecting…" : obsConnected ? "Connected" : "Disconnected"}
						</span>
					</div>
					<div className="flex flex-col gap-1">
						<label htmlFor="obs-pwd" className="text-xs font-medium">
							WebSocket password
						</label>
						<Input
							id="obs-pwd"
							type="password"
							placeholder="Enter OBS password…"
							value={password}
							onChange={onPwdChange}
							className="h-7 px-2 py-1"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium">Send rate (updates/sec)</span>
						<div className="flex items-center gap-2">
							<Slider
								value={[obsSendRate]}
								min={1}
								max={120}
								step={1}
								onValueChange={(v) => setObsSendRate(v[0])}
								aria-label="Adjust OBS send rate"
							/>
							<span className="text-xs w-10 text-right">{obsSendRate}</span>
						</div>
					</div>
					<Button onClick={() => onToggle(password)} className="w-full" disabled={!password}>
						{obsConnected ? "Disconnect OBS" : "Connect OBS"}
					</Button>
					{obsError && <div className="text-xs text-destructive">{obsError}</div>}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
