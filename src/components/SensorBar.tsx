import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

// Maximum value possible from sensors
const maxSensorVal = 1023;

interface SensorBarProps {
	value: number;
	index: number;
	maxValue?: number;
	threshold: number;
	onThresholdChange: (index: number, value: number) => void;
	label: string;
	color: string;
	showThresholdText: boolean;
	showValueText: boolean;
	thresholdColor: string;
	useThresholdColor: boolean;
	useGradient: boolean;
	isLocked?: boolean;
	hideLabel?: boolean;
	hideControls?: boolean;
	backgroundColor?: string;
	labelColor?: string;
}

// Component for individual sensor bar
const SensorBar = ({
	value,
	index,
	maxValue = maxSensorVal,
	threshold,
	onThresholdChange,
	label,
	color,
	showThresholdText,
	showValueText,
	thresholdColor,
	useThresholdColor,
	useGradient,
	isLocked = false,
	hideLabel = false,
	hideControls = false,
	backgroundColor = "white",
	labelColor = "inherit",
}: SensorBarProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const isDragging = useRef<boolean>(false);
	const [inputValue, setInputValue] = useState<string>(threshold.toString());
	const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
		width: 0,
		height: 0,
	});

	const updateThreshold = (y: number) => {
		if (isLocked) return;

		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const height = rect.height;

		// Calculate threshold value based on click position
		const newThreshold = Math.round(maxValue * (1 - (y - rect.top) / height));
		const clampedValue = Math.max(0, Math.min(maxValue, newThreshold));

		onThresholdChange(index, clampedValue);
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		if (isLocked) return;

		isDragging.current = true;
		updateThreshold(e.clientY);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging.current) return;
		updateThreshold(e.clientY);
	};

	// Update input value when threshold changes
	useEffect(() => {
		setInputValue(threshold.toString());
	}, [threshold]);

	const validateAndUpdateThreshold = () => {
		if (isLocked) return;

		const newValue = Number.parseInt(inputValue, 10);
		if (!Number.isNaN(newValue) && newValue >= 0 && newValue <= maxValue) {
			onThresholdChange(index, newValue);
		} else {
			// Reset input to current threshold if invalid
			setInputValue(threshold.toString());
		}
	};

	const handleIncrement = () => {
		if (isLocked) return;
		const newValue = Math.min(threshold + 1, maxValue);
		onThresholdChange(index, newValue);
	};

	const handleDecrement = () => {
		if (isLocked) return;
		const newValue = Math.max(threshold - 1, 0);
		onThresholdChange(index, newValue);
	};

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			if (!isDragging.current) return;
			updateThreshold(e.clientY);
		};

		const onMouseUp = () => {
			isDragging.current = false;
		};

		// Add global event listeners to track mouse movements outside the component
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);

		return () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};
	}, [updateThreshold]);

	// Set up the resize observer to detect container size changes
	useEffect(() => {
		const canvasContainer = containerRef.current?.querySelector(".canvas-container");
		if (!canvasContainer) return;

		// Function to handle resize
		const updateCanvasSize = () => {
			const rect = canvasContainer.getBoundingClientRect();
			setDimensions({
				width: rect.width,
				height: rect.height,
			});
		};

		// Initial size calculation
		updateCanvasSize();

		// Create resize observer
		const resizeObserver = new ResizeObserver(updateCanvasSize);
		resizeObserver.observe(canvasContainer);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	// Draw the canvas when dimensions, value, or threshold changes
	useEffect(() => {
		if (!value) return;
		const canvas = canvasRef.current;
		if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Manage pixel ratio
		const dpr = window.devicePixelRatio || 1;
		const width = Math.floor(dimensions.width);
		const height = Math.floor(dimensions.height);

		// Set canvas dimensions with pixel ratio
		canvas.width = width * dpr;
		canvas.height = height * dpr;

		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;

		ctx.scale(dpr, dpr);

		ctx.imageSmoothingEnabled = false;

		ctx.clearRect(0, 0, width, height);

		// Use threshold color if enabled and value meets or exceeds threshold
		const activeColor = useThresholdColor && value >= threshold ? thresholdColor : color;

		// Draw bar
		const barHeight = (value / maxValue) * height;

		if (useGradient) {
			const grad = ctx.createLinearGradient(0, 0, 0, height);
			// Support both hex and rgba input colors
			const parseColor = (c: string): { r: number; g: number; b: number; a: number } => {
				if (c.startsWith("rgba")) {
					const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
					if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] ? Number(m[4]) : 1 };
				}
				if (c.startsWith("#")) {
					const r = Number.parseInt(c.slice(1, 3), 16);
					const g = Number.parseInt(c.slice(3, 5), 16);
					const b = Number.parseInt(c.slice(5, 7), 16);
					return { r, g, b, a: 1 };
				}
				return { r: 0, g: 0, b: 0, a: 1 };
			};

			const { r, g, b, a } = parseColor(activeColor);
			grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
			grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a * 0.3))})`);
			ctx.fillStyle = grad;
		} else {
			ctx.fillStyle = activeColor;
		}

		ctx.fillRect(0, height - barHeight, width, barHeight);

		// Draw threshold line
		const thresholdY = Math.round(height - (threshold / maxValue) * height);
		ctx.beginPath();
		ctx.moveTo(0, thresholdY);
		ctx.lineTo(width, thresholdY);
		ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
		ctx.lineWidth = 2;
		ctx.stroke();

		// Draw border
		ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
		ctx.lineWidth = 1;
		ctx.strokeRect(0, 0, width, height);

		// Draw value text
		if (showValueText) {
			ctx.fillStyle = "black";
			ctx.font = `${12 * (1 / dpr)}px sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "top";

			// Position text at integer coordinates
			const valueTextX = Math.floor(width / 2);
			const valueTextY = 4;

			ctx.fillText(value.toString(), valueTextX, valueTextY);
		}

		// Draw threshold value text
		if (showThresholdText) {
			ctx.fillStyle = "black";
			ctx.font = `${11 * (1 / dpr)}px sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "bottom";

			// Position text at integer coordinates
			const thresholdTextX = Math.floor(width / 2);
			const thresholdTextY = thresholdY - 2;

			ctx.fillText(`${threshold}`, thresholdTextX, thresholdTextY);
		}
	}, [
		dimensions,
		value,
		maxValue,
		threshold,
		color,
		showThresholdText,
		showValueText,
		thresholdColor,
		useThresholdColor,
		useGradient,
	]);

	return (
		<div className="flex flex-col items-center select-none h-full px-4" ref={containerRef}>
			{!hideLabel && (
				<div className="text-xs font-medium mb-1 text-center" style={{ color: labelColor }}>
					{label}
				</div>
			)}
			<div
				className={`relative flex-1 w-full flex flex-col ${!hideControls ? "mb-2" : ""} canvas-container min-h-[200px]`}
			>
				<canvas
					ref={canvasRef}
					className={`border border-border rounded w-full h-full ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
					style={{ backgroundColor }}
					aria-label={label}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
				/>
			</div>
			{!hideControls && (
				<div className="flex items-center gap-0.5 w-full justify-center">
					<Button
						variant="link"
						size="icon"
						className="size-6 shrink-0 p-0 hover:cursor-pointer"
						onClick={handleDecrement}
						disabled={isLocked}
						aria-label="Decrease threshold"
					>
						<Minus className="size-3" />
					</Button>
					<Input
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onBlur={() => validateAndUpdateThreshold()}
						onKeyDown={(e) => {
							if (e.key === "Enter") validateAndUpdateThreshold();
						}}
						disabled={isLocked}
						className="h-6 text-xs text-center px-0.5 w-12 min-w-12 shadow-none rounded-sm"
						aria-label={`Threshold value for ${label}`}
					/>
					<Button
						variant="link"
						size="icon"
						className="size-6 shrink-0 p-0 hover:cursor-pointer"
						onClick={handleIncrement}
						disabled={isLocked}
						aria-label="Increase threshold"
					>
						<Plus className="size-3" />
					</Button>
				</div>
			)}
		</div>
	);
};

export default SensorBar;
export { maxSensorVal };
