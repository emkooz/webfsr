import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RgbaColorPicker } from "react-colorful";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { useProfileManager } from "~/lib/useProfileManager";
import SensorBar, { maxSensorVal } from "./SensorBar";
import TimeSeriesGraph from "./TimeSeriesGraph";

const SENSOR_COLOR_KEYS = ["sensor-0", "sensor-1", "sensor-2", "sensor-3", "sensor-4", "sensor-5"];

export type OBSComponentDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	password?: string;
};

type ComponentType = "graph" | "sensors" | "heartrate";

interface GraphConfig {
	timeWindow: number;
	sensorColors: string[];
	thresholdLineOpacity: number;
	showGridLines: boolean;
	showThresholdLines: boolean;
	showActivation: boolean;
	activationColor: string;
	showSensorLabels: boolean;
	sensorLabelColor: string;
	sensorLabels: string[];
}

interface SensorsConfig {
	sensorColors: string[];
	showThresholdText: boolean;
	showValueText: boolean;
	useThresholdColor: boolean;
	useSingleColor: boolean;
	useGradient: boolean;
	thresholdColor: string;
	singleBarColor: string;
	backgroundColor: string;
	hideLabels: boolean;
	hideControls: boolean;
	visibleSensors: string;
	sensorBackgroundColor: string;
	sensorLabelColor: string;
	sensorLabels: string[];
}

interface HeartrateConfig {
	animateHeartbeat: boolean;
	verticalAlignHeartrate: boolean;
	fillHeartIcon: boolean;
	showBpmText: boolean;
}

type ComponentConfig = GraphConfig | SensorsConfig | HeartrateConfig;

const hexToRgba = (hex: string): { r: number; g: number; b: number; a: number } => {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: Number.parseInt(result[1], 16),
				g: Number.parseInt(result[2], 16),
				b: Number.parseInt(result[3], 16),
				a: 1,
			}
		: { r: 0, g: 0, b: 0, a: 1 };
};

const rgbaToString = (rgba: { r: number; g: number; b: number; a: number }): string => {
	return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`;
};

// Encode/decode color arrays for URL without losing commas inside rgba()
const encodeColorListForUrl = (colors: string[]): string => colors.map((c) => encodeURIComponent(c)).join(";");
const decodeColorListFromUrl = (colorsParam: string): string[] =>
	colorsParam.includes(";") ? colorsParam.split(";").map((c) => decodeURIComponent(c)) : colorsParam.split(",");

// Encode/decode sensor labels for URL
const encodeSensorLabelsForUrl = (labels: string[]): string =>
	labels.map((label) => encodeURIComponent(label)).join(";");
const decodeSensorLabelsFromUrl = (labelsParam: string): string[] =>
	labelsParam.split(";").map((label) => decodeURIComponent(label));

const parseRgbaString = (rgbaString: string): { r: number; g: number; b: number; a: number } => {
	// Handle hex colors
	if (rgbaString.startsWith("#")) {
		return hexToRgba(rgbaString);
	}

	// Handle rgba/rgb strings
	const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
	if (match) {
		return {
			r: Number.parseInt(match[1], 10),
			g: Number.parseInt(match[2], 10),
			b: Number.parseInt(match[3], 10),
			a: match[4] ? Number.parseFloat(match[4]) : 1,
		};
	}

	// Fallback for unrecognized formats
	return { r: 0, g: 0, b: 0, a: 1 };
};

const DEFAULT_CONFIGS = {
	graph: {
		timeWindow: 2500,
		sensorColors: ["#3a7da3", "#d4607c", "#8670d4", "#d49b20", "#459ea0", "#d45478"],
		thresholdLineOpacity: 0.7,
		showGridLines: false,
		showThresholdLines: true,
		showActivation: true,
		activationColor: "#4dd253",
		showSensorLabels: true,
		sensorLabelColor: "rgba(255, 255, 255, 0.9)",
		sensorLabels: [],
	} as GraphConfig,
	sensors: {
		sensorColors: ["#3a7da3", "#d4607c", "#8670d4", "#d49b20", "#459ea0", "#d45478"],
		showThresholdText: true,
		showValueText: true,
		useThresholdColor: true,
		useSingleColor: false,
		useGradient: false,
		thresholdColor: "#4dd253",
		singleBarColor: "#3b82f6",
		backgroundColor: "#000000",
		hideLabels: false,
		hideControls: true,
		visibleSensors: "all",
		sensorBackgroundColor: "#ffffff",
		sensorLabelColor: "rgba(255, 255, 255, 0.9)",
		sensorLabels: [],
	} as SensorsConfig,
	heartrate: {
		animateHeartbeat: true,
		verticalAlignHeartrate: false,
		fillHeartIcon: true,
		showBpmText: true,
	} as HeartrateConfig,
};

export function OBSComponentDialog({ open, onOpenChange, password: passwordProp }: OBSComponentDialogProps) {
	const { activeProfile } = useProfileManager();
	const [selectedComponent, setSelectedComponent] = useState<ComponentType>("graph");
	const [graphConfig, setGraphConfig] = useState<GraphConfig>(DEFAULT_CONFIGS.graph);
	const [sensorsConfig, setSensorsConfig] = useState<SensorsConfig>(() => ({
		...DEFAULT_CONFIGS.sensors,
		sensorLabels: activeProfile?.sensorLabels || [],
	}));
	const [url, setUrl] = useState("");
	const [copied, setCopied] = useState(false);
	const [timeWindowInput, setTimeWindowInput] = useState<string>("");

	// Update sensor labels when dialog opens or active profile changes
	useEffect(() => {
		if (open && activeProfile?.sensorLabels) {
			setSensorsConfig((prev) => ({
				...prev,
				sensorLabels: activeProfile.sensorLabels || [],
			}));
			setGraphConfig((prev) => ({
				...prev,
				sensorLabels: activeProfile.sensorLabels || [],
			}));
		}
	}, [open, activeProfile?.sensorLabels]);

	// Sync timeWindowInput with graphConfig.timeWindow when dialog opens or config changes
	useEffect(() => {
		if (open) {
			setTimeWindowInput(graphConfig.timeWindow.toString());
		}
	}, [open, graphConfig.timeWindow]);

	const config =
		selectedComponent === "graph"
			? graphConfig
			: selectedComponent === "sensors"
				? sensorsConfig
				: DEFAULT_CONFIGS.heartrate;

	const previewContainerRef = useRef<HTMLDivElement>(null);
	const sensorsInnerRef = useRef<HTMLDivElement>(null);
	const [sensorsScale, setSensorsScale] = useState(1);
	const [sensorsBaseWidth, setSensorsBaseWidth] = useState<number>(960);
	const [sensorsBaseHeight, setSensorsBaseHeight] = useState<number>(380);

	// Mock data for preview
	const [mockTime, setMockTime] = useState(0);
	const mockValues = Array.from({ length: 6 }, (_, index) => {
		const phase = mockTime * 0.15 + index * 0.8;
		const normalized = Math.sin(phase) * 0.4 + 0.5;
		const clamped = Math.max(0, Math.min(1, normalized));
		return Math.round(clamped * maxSensorVal);
	});
	const mockThresholds = Array.from({ length: 6 }, () => Math.round(maxSensorVal * 0.6));

	const mockLabels = Array.from({ length: 6 }, (_, index) => {
		const configuredLabels = (config as SensorsConfig).sensorLabels || [];
		return configuredLabels[index] || `Sensor ${index + 1}`;
	});

	useEffect(() => {
		const interval = setInterval(() => {
			setMockTime((prev) => prev + 1);
		}, 50);
		return () => clearInterval(interval);
	}, []);

	// Scale sensors preview to fit container
	useEffect(() => {
		if (selectedComponent !== "sensors") return;

		const updateScale = () => {
			const container = previewContainerRef.current;
			const inner = sensorsInnerRef.current;
			if (!container || !inner) return;

			// Reset transform to measure natural size
			inner.style.transform = "scale(1)";
			const containerRect = container.getBoundingClientRect();

			// Compute natural base dimensions for horizontal layout
			const visibleIndices = getSelectedSensorIndices();
			const count = visibleIndices.length; // number of visible sensors
			const perBarW = 160; // matches OBS preview baseline width per bar
			const perBarH = 380; // baseline height per bar with canvas min-height for threshold text
			const gap = 16; // Tailwind gap-4

			const baseWidth = perBarW * count + gap * Math.max(0, count - 1);
			const baseHeight = perBarH; // All bars same height in horizontal layout

			setSensorsBaseWidth(baseWidth);
			setSensorsBaseHeight(baseHeight);

			// Calculate scale to fit both dimensions
			const scaleX = Math.min(containerRect.width / baseWidth, 1);
			const scaleY = Math.min(containerRect.height / baseHeight, 1);
			const scale = Math.min(scaleX, scaleY);

			setSensorsScale(scale);
		};

		updateScale();
		const ro = new ResizeObserver(updateScale);
		if (previewContainerRef.current) ro.observe(previewContainerRef.current);
		return () => ro.disconnect();
	}, [selectedComponent, config]);

	useEffect(() => {
		generateUrl();
	}, [config, selectedComponent, passwordProp, open]);

	const isGraphConfig = (c: ComponentConfig): c is GraphConfig =>
		c != null && typeof (c as GraphConfig).timeWindow === "number" && Array.isArray((c as GraphConfig).sensorColors);
	const isSensorsConfig = (c: ComponentConfig): c is SensorsConfig =>
		c != null && Array.isArray((c as SensorsConfig).sensorColors);

	const generateUrl = () => {
		const baseUrl = `${window.location.origin}/obs/${selectedComponent}/`;
		const pwd = (passwordProp ?? activeProfile?.obsPassword) || "YOUR_OBS_PASSWORD_HERE";

		const params = new URLSearchParams({ pwd: pwd });

		// Add component-specific parameters
		if (selectedComponent === "graph" && isGraphConfig(config)) {
			const graphConfig = config;
			if (graphConfig.timeWindow !== DEFAULT_CONFIGS.graph.timeWindow) {
				params.set("window", graphConfig.timeWindow.toString());
			}
			if (graphConfig.sensorColors.join(",") !== DEFAULT_CONFIGS.graph.sensorColors.join(",")) {
				params.set("colors", encodeColorListForUrl(graphConfig.sensorColors));
			}
			if (graphConfig.thresholdLineOpacity !== DEFAULT_CONFIGS.graph.thresholdLineOpacity) {
				params.set("thresholdOpacity", graphConfig.thresholdLineOpacity.toString());
			}
			if (!graphConfig.showGridLines) params.set("grid", "false");
			if (!graphConfig.showSensorLabels) params.set("showSensorLabels", "false");
			if (!graphConfig.showThresholdLines) params.set("thresholds", "false");
			if (!graphConfig.showActivation) params.set("activation", "false");
			if (graphConfig.activationColor !== DEFAULT_CONFIGS.graph.activationColor) {
				params.set("activationColor", encodeURIComponent(graphConfig.activationColor));
			}
			if (graphConfig.sensorLabelColor !== DEFAULT_CONFIGS.graph.sensorLabelColor) {
				params.set("labelColor", graphConfig.sensorLabelColor);
			}
			if (
				graphConfig.sensorLabels &&
				graphConfig.sensorLabels.length > 0 &&
				graphConfig.sensorLabels.some((label, index) => label !== `Sensor ${index + 1}`)
			) {
				params.set("sensorLabels", encodeSensorLabelsForUrl(graphConfig.sensorLabels));
			}
		} else if (selectedComponent === "sensors" && isSensorsConfig(config)) {
			const sensorsConfig = config;
			if (
				sensorsConfig.sensorColors &&
				sensorsConfig.sensorColors.join(",") !== DEFAULT_CONFIGS.sensors.sensorColors.join(",")
			) {
				params.set("colors", encodeColorListForUrl(sensorsConfig.sensorColors));
			}
			if (sensorsConfig.showThresholdText !== undefined && !sensorsConfig.showThresholdText)
				params.set("showThreshold", "false");
			if (sensorsConfig.showValueText !== undefined && !sensorsConfig.showValueText) params.set("showValue", "false");
			if (sensorsConfig.useThresholdColor !== undefined && !sensorsConfig.useThresholdColor)
				params.set("useThresholdColor", "false");
			if (sensorsConfig.useSingleColor && sensorsConfig.useSingleColor) params.set("singleColor", "true");
			if (sensorsConfig.useGradient && sensorsConfig.useGradient) params.set("gradient", "true");
			if (sensorsConfig.thresholdColor && sensorsConfig.thresholdColor !== DEFAULT_CONFIGS.sensors.thresholdColor) {
				params.set("thresholdColor", sensorsConfig.thresholdColor);
			}
			if (sensorsConfig.singleBarColor && sensorsConfig.singleBarColor !== DEFAULT_CONFIGS.sensors.singleBarColor) {
				params.set("singleBarColor", sensorsConfig.singleBarColor);
			}
			if (sensorsConfig.hideLabels && sensorsConfig.hideLabels) params.set("hideLabels", "true");
			if (sensorsConfig.hideControls !== undefined && !sensorsConfig.hideControls) params.set("hideControls", "false");
			if (sensorsConfig.visibleSensors && sensorsConfig.visibleSensors !== DEFAULT_CONFIGS.sensors.visibleSensors) {
				params.set("sensors", sensorsConfig.visibleSensors);
			}
			if (
				sensorsConfig.sensorBackgroundColor &&
				sensorsConfig.sensorBackgroundColor !== DEFAULT_CONFIGS.sensors.sensorBackgroundColor
			) {
				params.set("sensorBg", sensorsConfig.sensorBackgroundColor);
			}
			if (
				sensorsConfig.sensorLabelColor &&
				sensorsConfig.sensorLabelColor !== DEFAULT_CONFIGS.sensors.sensorLabelColor
			) {
				params.set("labelColor", sensorsConfig.sensorLabelColor);
			}
			if (
				sensorsConfig.sensorLabels &&
				sensorsConfig.sensorLabels.length > 0 &&
				sensorsConfig.sensorLabels.some((label, index) => label !== `Sensor ${index + 1}`)
			) {
				params.set("sensorLabels", encodeSensorLabelsForUrl(sensorsConfig.sensorLabels));
			}
		}

		const finalUrl = `${baseUrl}?${params.toString()}`;
		setUrl(finalUrl);
	};

	const updateGraphConfig = (updates: Partial<GraphConfig>) => {
		setGraphConfig((prev) => ({ ...prev, ...updates }));
	};

	const updateSensorsConfig = (updates: Partial<SensorsConfig>) => {
		setSensorsConfig((prev) => ({ ...prev, ...updates }));
	};

	const getSelectedSensorIndices = () => {
		if (!sensorsConfig.visibleSensors || sensorsConfig.visibleSensors === "all") {
			return Array.from({ length: 6 }, (_, i) => i);
		}

		return sensorsConfig.visibleSensors
			.split(",")
			.map((s) => Number.parseInt(s.trim(), 10))
			.filter((i) => !Number.isNaN(i) && i >= 0 && i < 6);
	};

	const updateSelectedSensors = (selectedIndices: number[]) => {
		if (selectedIndices.length === 0) {
			updateSensorsConfig({ visibleSensors: "none" });
		} else if (selectedIndices.length === 6) {
			updateSensorsConfig({ visibleSensors: "all" });
		} else {
			updateSensorsConfig({ visibleSensors: selectedIndices.sort((a, b) => a - b).join(",") });
		}
	};

	const handleUrlChange = (newUrl: string) => {
		setUrl(newUrl);
		try {
			const url = new URL(newUrl);
			const params = new URLSearchParams(url.search);

			if (selectedComponent === "graph") {
				const graphConfig = { ...DEFAULT_CONFIGS.graph };
				const windowParam = params.get("window");
				if (windowParam) graphConfig.timeWindow = Number(windowParam);

				const colorsParam = params.get("colors");
				if (colorsParam) graphConfig.sensorColors = decodeColorListFromUrl(colorsParam);

				const thresholdOpacity = params.get("thresholdOpacity");
				if (thresholdOpacity) graphConfig.thresholdLineOpacity = Number(thresholdOpacity);

				graphConfig.showGridLines = params.get("grid") !== "false";
				graphConfig.showSensorLabels = params.get("showSensorLabels") !== "false";
				graphConfig.showThresholdLines = params.get("thresholds") !== "false";
				graphConfig.showActivation = params.get("activation") !== "false";

				const activationColor = params.get("activationColor");
				if (activationColor) graphConfig.activationColor = decodeURIComponent(activationColor);

				const labelColor = params.get("labelColor");
				if (labelColor) graphConfig.sensorLabelColor = labelColor;

				const sensorLabels = params.get("sensorLabels");
				if (sensorLabels) graphConfig.sensorLabels = decodeSensorLabelsFromUrl(sensorLabels);

				setGraphConfig(graphConfig);
			} else if (selectedComponent === "sensors") {
				const sensorsConfig = { ...DEFAULT_CONFIGS.sensors };

				const colorsParam = params.get("colors");
				if (colorsParam) sensorsConfig.sensorColors = decodeColorListFromUrl(colorsParam);

				sensorsConfig.showThresholdText = params.get("showThreshold") !== "false";
				sensorsConfig.showValueText = params.get("showValue") !== "false";
				sensorsConfig.useThresholdColor = params.get("useThresholdColor") !== "false";
				sensorsConfig.useSingleColor = params.get("singleColor") === "true";
				sensorsConfig.useGradient = params.get("gradient") === "true";
				sensorsConfig.hideLabels = params.get("hideLabels") === "true";
				sensorsConfig.hideControls = params.get("hideControls") !== "false";

				const thresholdColor = params.get("thresholdColor");
				if (thresholdColor) sensorsConfig.thresholdColor = thresholdColor;

				const singleBarColor = params.get("singleBarColor");
				if (singleBarColor) sensorsConfig.singleBarColor = singleBarColor;

				const sensors = params.get("sensors");
				if (sensors) sensorsConfig.visibleSensors = sensors;

				const sensorBg = params.get("sensorBg");
				if (sensorBg) sensorsConfig.sensorBackgroundColor = sensorBg;

				const labelColor = params.get("labelColor");
				if (labelColor) sensorsConfig.sensorLabelColor = labelColor;

				const sensorLabels = params.get("sensorLabels");
				if (sensorLabels) sensorsConfig.sensorLabels = decodeSensorLabelsFromUrl(sensorLabels);

				setSensorsConfig(sensorsConfig);
			}
		} catch (err) {
			console.error("Failed to parse URL:", err);
		}
	};

	const renderPreview = () => {
		if (selectedComponent === "graph") {
			const graphConfig = config as GraphConfig;
			const previewLabels = graphConfig.sensorLabels.length > 0 ? graphConfig.sensorLabels : mockLabels;

			return (
				<div className="w-full h-full bg-black overflow-hidden">
					<TimeSeriesGraph
						latestData={{ values: mockValues }}
						timeWindow={graphConfig.timeWindow}
						thresholds={mockThresholds}
						sensorLabels={previewLabels}
						sensorColors={graphConfig.sensorColors}
						showGridLines={graphConfig.showGridLines}
						showThresholdLines={graphConfig.showThresholdLines}
						thresholdLineOpacity={graphConfig.thresholdLineOpacity}
						showLegend={false}
						showBorder={false}
						showActivation={graphConfig.showActivation}
						activationColor={graphConfig.activationColor}
						showSensorLabels={graphConfig.showSensorLabels}
						sensorLabelColor={graphConfig.sensorLabelColor}
					/>
				</div>
			);
		}

		if (selectedComponent === "sensors") {
			const sensorsConfig = config as SensorsConfig;
			const sensorColors = sensorsConfig.sensorColors || DEFAULT_CONFIGS.sensors.sensorColors;

			const visibleIndices = getSelectedSensorIndices();

			const sensorBars = visibleIndices.map((sensorIndex) => (
				<div key={`mock-sensor-wrap-${mockLabels[sensorIndex]}-${sensorIndex}`} className="min-w-0 h-full w-full">
					<SensorBar
						key={`mock-sensor-${mockLabels[sensorIndex]}-${sensorIndex}`}
						value={mockValues[sensorIndex]}
						index={sensorIndex}
						threshold={mockThresholds[sensorIndex]}
						onThresholdChange={() => {}}
						label={mockLabels[sensorIndex]}
						color={
							sensorsConfig.useSingleColor
								? sensorsConfig.singleBarColor
								: sensorColors[sensorIndex % sensorColors.length]
						}
						showThresholdText={sensorsConfig.showThresholdText}
						showValueText={sensorsConfig.showValueText}
						thresholdColor={sensorsConfig.thresholdColor}
						useThresholdColor={sensorsConfig.useThresholdColor}
						useGradient={sensorsConfig.useGradient}
						isLocked={true}
						hideLabel={sensorsConfig.hideLabels}
						hideControls={sensorsConfig.hideControls}
						backgroundColor={sensorsConfig.sensorBackgroundColor}
						labelColor={sensorsConfig.sensorLabelColor}
					/>
				</div>
			));

			const renderSensors = () => {
				return <div className="flex gap-4 h-full items-center w-full">{sensorBars}</div>;
			};

			return (
				<div className="w-full h-full" style={{ backgroundColor: "#000000" }}>
					{renderSensors()}
				</div>
			);
		}

		// Heartrate component preview (placeholder)
		return (
			<div className="w-full h-full bg-black overflow-hidden flex items-center justify-center">
				<div className="text-white text-center">
					<div className="text-lg">Heartrate Monitor</div>
					<div className="text-sm text-gray-400">Not currently implemented</div>
				</div>
			</div>
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[1280px] max-h-[85vh] overflow-hidden">
				<DialogHeader className="sr-only">
					<DialogTitle>Create OBS Component</DialogTitle>
					<DialogDescription>Configure your OBS Browser Source component and copy the generated URL.</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col h-full max-h-[calc(85vh-120px)]">
					<div className="space-y-3 pb-3">
						<div className="flex justify-center">
							<div className="w-full max-w-md space-y-2">
								<Label htmlFor="component-type" className="text-center block text-sm font-medium">
									Component Type
								</Label>
								<Select value={selectedComponent} onValueChange={(value: ComponentType) => setSelectedComponent(value)}>
									<SelectTrigger className="h-11 text-base w-80 mx-auto">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="graph">Graph</SelectItem>
										<SelectItem value="sensors">Sensors</SelectItem>
										<SelectItem value="heartrate">Heartrate Monitor</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Preview section */}
						<div className="space-y-2">
							<div
								ref={previewContainerRef}
								className="border rounded-lg bg-black h-[360px] md:h-[380px] overflow-hidden flex items-center justify-center"
							>
								{/* Sensor preview scales to fit; graph/heartrate render normally */}
								{selectedComponent === "sensors" ? (
									<div
										ref={sensorsInnerRef}
										className="origin-top-left"
										style={{
											width: `${sensorsBaseWidth}px`,
											height: `${sensorsBaseHeight}px`,
											transform: `scale(${sensorsScale})`,
										}}
									>
										{renderPreview()}
									</div>
								) : (
									renderPreview()
								)}
							</div>
						</div>

						{/* URL section */}
						<div className="mt-3 flex items-center gap-2">
							<Input
								value={url}
								onChange={(e) => handleUrlChange(e.target.value)}
								className="font-mono text-xs h-9"
								placeholder="URL will appear here…"
							/>
							<Button
								variant="outline"
								className="w-32"
								onClick={() => {
									navigator.clipboard
										.writeText(url)
										.then(() => setCopied(true))
										.finally(() => setTimeout(() => setCopied(false), 1200));
								}}
								disabled={!url}
							>
								{copied ? (
									<div className="flex items-center gap-1">
										<Check className="w-4 h-4" />
										Copied
									</div>
								) : (
									"Copy URL"
								)}
							</Button>
						</div>
					</div>

					{/* Settings Section */}
					<div className="flex-1 overflow-y-auto">
						{selectedComponent === "graph" && (
							<div className="flex flex-wrap gap-6 justify-center items-start">
								<div className="space-y-4 min-w-[300px] max-w-[400px]">
									<Label className="text-lg font-semibold">Graph Settings</Label>
									<div className="space-y-3">
										<div className="space-y-2">
											<Label>Time Window (ms)</Label>
											<Input
												type="number"
												step="100"
												value={timeWindowInput}
												onChange={(e) => setTimeWindowInput(e.target.value)}
												onBlur={() => {
													const numValue = Number(timeWindowInput);
													if (timeWindowInput === "" || Number.isNaN(numValue)) {
														updateGraphConfig({ timeWindow: 2500 });
													} else {
														updateGraphConfig({ timeWindow: numValue });
													}
												}}
												onKeyDown={(e) => {
													const currentValue = Number(timeWindowInput) || 2500;

													if (e.key === "Enter") {
														e.preventDefault();
														const numValue = Number(timeWindowInput);
														if (timeWindowInput === "" || Number.isNaN(numValue)) {
															updateGraphConfig({ timeWindow: 2500 });
															setTimeWindowInput("2500");
														} else {
															updateGraphConfig({ timeWindow: numValue });
														}
														e.currentTarget.blur();
													} else if (e.key === "ArrowUp") {
														e.preventDefault();
														const newValue = currentValue + 100;
														setTimeWindowInput(newValue.toString());
														updateGraphConfig({ timeWindow: newValue });
													} else if (e.key === "ArrowDown") {
														e.preventDefault();
														const newValue = Math.max(0, currentValue - 100);
														setTimeWindowInput(newValue.toString());
														updateGraphConfig({ timeWindow: newValue });
													}
												}}
											/>
										</div>
										<div className="space-y-2">
											<Label>Sensor Labels</Label>
											<div className="grid grid-cols-2 gap-3">
												{Array.from({ length: 6 }, (_, index) => (
													<div key={`graph-sensor-label-input-${index + 1}`} className="space-y-2">
														<Input
															value={(config as GraphConfig).sensorLabels?.[index] || `Sensor ${index + 1}`}
															onChange={(e) => {
																const newLabels = [...((config as GraphConfig).sensorLabels || [])];
																newLabels[index] = e.target.value;
																updateGraphConfig({ sensorLabels: newLabels });
															}}
															className="h-8 text-sm"
															placeholder={`Sensor ${index + 1}`}
														/>
													</div>
												))}
											</div>
										</div>
									</div>
								</div>

								<div className="space-y-4 min-w-[300px] max-w-[400px]">
									<Label className="text-lg font-semibold">Colors</Label>
									<div className="space-y-4">
										<div className="space-y-3">
											<Label className="text-sm">Sensor Colors</Label>
											<div className="flex gap-2 flex-wrap">
												{(config as GraphConfig).sensorColors.map((color, index) => (
													<Popover key={`graph-${SENSOR_COLOR_KEYS[index]}`}>
														<PopoverTrigger asChild>
															<button
																type="button"
																className="w-8 h-8 rounded border cursor-pointer relative overflow-hidden"
																style={{
																	backgroundColor: color,
																	backgroundImage:
																		parseRgbaString(color).a < 1
																			? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
																			: "none",
																	backgroundSize: parseRgbaString(color).a < 1 ? "8px 8px" : "auto",
																	backgroundPosition:
																		parseRgbaString(color).a < 1 ? "0 0, 0 4px, 4px -4px, -4px 0px" : "auto",
																}}
															/>
														</PopoverTrigger>
														<PopoverContent className="w-auto p-3">
															<RgbaColorPicker
																color={parseRgbaString(color)}
																onChange={(newColor) => {
																	const newColors = [...(config as GraphConfig).sensorColors];
																	newColors[index] = rgbaToString(newColor);
																	updateGraphConfig({ sensorColors: newColors });
																}}
															/>
														</PopoverContent>
													</Popover>
												))}
											</div>
										</div>
										<div className="space-y-3">
											<Label className="text-sm">Activation Color</Label>
											<Popover>
												<PopoverTrigger asChild>
													<button
														type="button"
														className="w-8 h-8 rounded border cursor-pointer relative overflow-hidden"
														style={{
															backgroundColor: (config as GraphConfig).activationColor,
															backgroundImage:
																parseRgbaString((config as GraphConfig).activationColor).a < 1
																	? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
																	: "none",
															backgroundSize:
																parseRgbaString((config as GraphConfig).activationColor).a < 1 ? "8px 8px" : "auto",
															backgroundPosition:
																parseRgbaString((config as GraphConfig).activationColor).a < 1
																	? "0 0, 0 4px, 4px -4px, -4px 0px"
																	: "auto",
														}}
													/>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-3">
													<RgbaColorPicker
														color={parseRgbaString((config as GraphConfig).activationColor)}
														onChange={(color) => updateGraphConfig({ activationColor: rgbaToString(color) })}
													/>
												</PopoverContent>
											</Popover>
										</div>
										<div className="space-y-2">
											<Label className="text-sm">Threshold Line Opacity</Label>
											<Slider
												value={[(config as GraphConfig).thresholdLineOpacity]}
												min={0}
												max={1}
												step={0.1}
												onValueChange={(value) => updateGraphConfig({ thresholdLineOpacity: value[0] })}
											/>
										</div>
									</div>
								</div>

								<div className="space-y-4 min-w-[300px] max-w-[400px]">
									<Label className="text-lg font-semibold">Display Options</Label>
									<div className="space-y-3">
										<div className="flex items-center space-x-2">
											<Checkbox
												id="showSensorLabels"
												checked={(config as GraphConfig).showSensorLabels}
												onCheckedChange={(checked) => updateGraphConfig({ showSensorLabels: Boolean(checked) })}
											/>
											<Label htmlFor="showSensorLabels" className="cursor-pointer">
												Show Sensor Labels
											</Label>
										</div>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="showThresholdLines"
												checked={(config as GraphConfig).showThresholdLines}
												onCheckedChange={(checked) => updateGraphConfig({ showThresholdLines: Boolean(checked) })}
											/>
											<Label htmlFor="showThresholdLines" className="cursor-pointer">
												Show Threshold Lines
											</Label>
										</div>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="showActivation"
												checked={(config as GraphConfig).showActivation}
												onCheckedChange={(checked) => updateGraphConfig({ showActivation: Boolean(checked) })}
											/>
											<Label htmlFor="showActivation" className="cursor-pointer">
												Show Activation
											</Label>
										</div>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="showGridLines"
												checked={(config as GraphConfig).showGridLines}
												onCheckedChange={(checked) => updateGraphConfig({ showGridLines: Boolean(checked) })}
											/>
											<Label htmlFor="showGridLines" className="cursor-pointer">
												Show Grid Lines
											</Label>
										</div>
									</div>
								</div>
							</div>
						)}

						{selectedComponent === "sensors" && (
							<div className="flex flex-wrap gap-6 justify-center items-start">
								<div className="space-y-4 min-w-[280px] max-w-[350px]">
									<Label className="text-lg font-semibold">Sensors</Label>
									<div className="space-y-4">
										<div className="space-y-2">
											<Label>Visible Sensors</Label>
											<div className="flex flex-wrap gap-2">
												{Array.from({ length: 6 }, (_, index) => (
													<div key={`sensor-select-${index + 1}`} className="flex items-center space-x-2">
														<Checkbox
															id={`sensor-${index}`}
															checked={getSelectedSensorIndices().includes(index)}
															onCheckedChange={(checked: boolean) => {
																const currentSelected = getSelectedSensorIndices();
																if (checked) {
																	updateSelectedSensors([...currentSelected, index]);
																} else {
																	updateSelectedSensors(currentSelected.filter((i) => i !== index));
																}
															}}
														/>
														<Label htmlFor={`sensor-${index}`} className="text-sm font-normal cursor-pointer">
															Sensor {index + 1}
														</Label>
													</div>
												))}
											</div>
										</div>
										<div className="space-y-2">
											<Label>Sensor Labels</Label>
											<div className="grid grid-cols-2 gap-3">
												{Array.from({ length: 6 }, (_, index) => (
													<div key={`sensor-label-input-${index + 1}`} className="space-y-2">
														<Input
															value={(config as SensorsConfig).sensorLabels?.[index] || `Sensor ${index + 1}`}
															onChange={(e) => {
																const newLabels = [...((config as SensorsConfig).sensorLabels || [])];
																newLabels[index] = e.target.value;
																updateSensorsConfig({ sensorLabels: newLabels });
															}}
															className="h-8 text-sm"
															placeholder={`Sensor ${index + 1}`}
														/>
													</div>
												))}
											</div>
										</div>
									</div>
								</div>

								{/* Colors */}
								<div className="space-y-4 min-w-[280px] max-w-[350px]">
									<Label className="text-lg font-semibold">Colors</Label>
									<div className="space-y-4">
										<div className="space-y-3">
											<Label className="text-sm">Sensor Colors</Label>
											<div className="flex gap-2 flex-wrap">
												{(config as SensorsConfig).sensorColors.map((color, index) => (
													<Popover key={`sensors-${SENSOR_COLOR_KEYS[index]}`}>
														<PopoverTrigger asChild>
															<button
																type="button"
																className="w-8 h-8 rounded border cursor-pointer relative overflow-hidden"
																style={{
																	backgroundColor: color,
																	backgroundImage:
																		parseRgbaString(color).a < 1
																			? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
																			: "none",
																	backgroundSize: parseRgbaString(color).a < 1 ? "8px 8px" : "auto",
																	backgroundPosition:
																		parseRgbaString(color).a < 1 ? "0 0, 0 4px, 4px -4px, -4px 0px" : "auto",
																}}
															/>
														</PopoverTrigger>
														<PopoverContent className="w-auto p-3">
															<RgbaColorPicker
																color={parseRgbaString(color)}
																onChange={(newColor) => {
																	const newColors = [...(config as SensorsConfig).sensorColors];
																	newColors[index] = rgbaToString(newColor);
																	updateSensorsConfig({ sensorColors: newColors });
																}}
															/>
														</PopoverContent>
													</Popover>
												))}
											</div>
										</div>
										<div className="grid grid-cols-2 gap-3">
											<div className="space-y-2">
												<Label className="text-sm">Sensor Background</Label>
												<Popover>
													<PopoverTrigger asChild>
														<button
															type="button"
															className="w-8 h-8 rounded border cursor-pointer relative overflow-hidden"
															style={{
																backgroundColor: (config as SensorsConfig).sensorBackgroundColor,
																backgroundImage:
																	parseRgbaString((config as SensorsConfig).sensorBackgroundColor).a < 1
																		? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
																		: "none",
																backgroundSize:
																	parseRgbaString((config as SensorsConfig).sensorBackgroundColor).a < 1
																		? "8px 8px"
																		: "auto",
																backgroundPosition:
																	parseRgbaString((config as SensorsConfig).sensorBackgroundColor).a < 1
																		? "0 0, 0 4px, 4px -4px, -4px 0px"
																		: "auto",
															}}
														/>
													</PopoverTrigger>
													<PopoverContent className="w-auto p-3">
														<RgbaColorPicker
															color={parseRgbaString((config as SensorsConfig).sensorBackgroundColor)}
															onChange={(color) => updateSensorsConfig({ sensorBackgroundColor: rgbaToString(color) })}
														/>
													</PopoverContent>
												</Popover>
											</div>
											<div className="space-y-2">
												<Label className="text-sm">Threshold</Label>
												<Popover>
													<PopoverTrigger asChild>
														<button
															type="button"
															className="w-8 h-8 rounded border cursor-pointer relative overflow-hidden"
															style={{
																backgroundColor: (config as SensorsConfig).thresholdColor,
																backgroundImage:
																	parseRgbaString((config as SensorsConfig).thresholdColor).a < 1
																		? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
																		: "none",
																backgroundSize:
																	parseRgbaString((config as SensorsConfig).thresholdColor).a < 1 ? "8px 8px" : "auto",
																backgroundPosition:
																	parseRgbaString((config as SensorsConfig).thresholdColor).a < 1
																		? "0 0, 0 4px, 4px -4px, -4px 0px"
																		: "auto",
															}}
														/>
													</PopoverTrigger>
													<PopoverContent className="w-auto p-3">
														<RgbaColorPicker
															color={parseRgbaString((config as SensorsConfig).thresholdColor)}
															onChange={(color) => updateSensorsConfig({ thresholdColor: rgbaToString(color) })}
														/>
													</PopoverContent>
												</Popover>
											</div>
										</div>

										{(config as SensorsConfig).useSingleColor && (
											<div className="space-y-2">
												<Label className="text-sm">Single Bar Color</Label>
												<Popover>
													<PopoverTrigger asChild>
														<button
															type="button"
															className="w-8 h-8 rounded border cursor-pointer relative overflow-hidden"
															style={{
																backgroundColor: (config as SensorsConfig).singleBarColor,
																backgroundImage:
																	parseRgbaString((config as SensorsConfig).singleBarColor).a < 1
																		? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
																		: "none",
																backgroundSize:
																	parseRgbaString((config as SensorsConfig).singleBarColor).a < 1 ? "8px 8px" : "auto",
																backgroundPosition:
																	parseRgbaString((config as SensorsConfig).singleBarColor).a < 1
																		? "0 0, 0 4px, 4px -4px, -4px 0px"
																		: "auto",
															}}
														/>
													</PopoverTrigger>
													<PopoverContent className="w-auto p-3">
														<RgbaColorPicker
															color={parseRgbaString((config as SensorsConfig).singleBarColor)}
															onChange={(color) => updateSensorsConfig({ singleBarColor: rgbaToString(color) })}
														/>
													</PopoverContent>
												</Popover>
											</div>
										)}
									</div>
								</div>

								<div className="space-y-4 min-w-[280px] max-w-[350px]">
									<Label className="text-lg font-semibold">Display Options</Label>
									<div className="space-y-3">
										<div className="flex items-center space-x-2">
											<Checkbox
												id="showThresholdText"
												checked={(config as SensorsConfig).showThresholdText}
												onCheckedChange={(checked) => updateSensorsConfig({ showThresholdText: Boolean(checked) })}
											/>
											<Label htmlFor="showThresholdText" className="cursor-pointer">
												Show Threshold Text
											</Label>
										</div>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="showValueText"
												checked={(config as SensorsConfig).showValueText}
												onCheckedChange={(checked) => updateSensorsConfig({ showValueText: Boolean(checked) })}
											/>
											<Label htmlFor="showValueText" className="cursor-pointer">
												Show Value Text
											</Label>
										</div>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="useThresholdColor"
												checked={(config as SensorsConfig).useThresholdColor}
												onCheckedChange={(checked) => updateSensorsConfig({ useThresholdColor: Boolean(checked) })}
											/>
											<Label htmlFor="useThresholdColor" className="cursor-pointer">
												Use Threshold Color
											</Label>
										</div>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="showLabels"
												checked={!((config as SensorsConfig).hideLabels ?? false)}
												onCheckedChange={(checked) => updateSensorsConfig({ hideLabels: !checked })}
											/>
											<Label htmlFor="showLabels" className="cursor-pointer">
												Show Labels
											</Label>
										</div>
										<div className="flex items-center space-x-2">
											<Checkbox
												id="useSingleColor"
												checked={(config as SensorsConfig).useSingleColor}
												onCheckedChange={(checked) => updateSensorsConfig({ useSingleColor: Boolean(checked) })}
											/>
											<Label htmlFor="useSingleColor" className="cursor-pointer">
												Use Single Color
											</Label>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
