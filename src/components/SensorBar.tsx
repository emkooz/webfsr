import { useRef, useCallback, useEffect, memo } from "react";

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
}

// Component for individual sensor bar
const SensorBar = memo(
	({
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
	}: SensorBarProps) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);
		const isDragging = useRef<boolean>(false);

		const updateThreshold = useCallback(
			(y: number) => {
				const canvas = canvasRef.current;
				if (!canvas) return;

				const rect = canvas.getBoundingClientRect();
				const height = rect.height;

				// Calculate threshold value based on click position
				const newThreshold = Math.round(maxValue * (1 - (y - rect.top) / height));
				const clampedValue = Math.max(0, Math.min(maxValue, newThreshold));

				onThresholdChange(index, clampedValue);
			},
			[maxValue, index, onThresholdChange],
		);

		const handleMouseDown = useCallback(
			(e: React.MouseEvent) => {
				isDragging.current = true;
				updateThreshold(e.clientY);
			},
			[updateThreshold],
		);

		const handleMouseMove = useCallback(
			(e: React.MouseEvent) => {
				if (!isDragging.current) return;
				updateThreshold(e.clientY);
			},
			[updateThreshold],
		);

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

		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			// Manage pixel ratio
			const dpr = window.devicePixelRatio || 1;
			const rect = canvas.getBoundingClientRect();

			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;

			ctx.scale(dpr, dpr);

			canvas.style.width = `${rect.width}px`;
			canvas.style.height = `${rect.height}px`;

			const width = rect.width;
			const height = rect.height;

			ctx.clearRect(0, 0, width, height);

			// Use threshold color if enabled and value meets or exceeds threshold
			const activeColor = useThresholdColor && value >= threshold ? thresholdColor : color;

			// Draw bar
			const barHeight = (value / maxValue) * height;

			if (useGradient) {
				// Create gradient
				const grad = ctx.createLinearGradient(0, 0, 0, height);
				grad.addColorStop(0, activeColor);
				grad.addColorStop(1, "rgba(255, 255, 255, 1.0)");
				ctx.fillStyle = grad;
			} else {
				// Use solid color
				ctx.fillStyle = activeColor;
			}

			ctx.fillRect(0, height - barHeight, width, barHeight);

			// Draw threshold line
			const thresholdY = height - (threshold / maxValue) * height;
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
				ctx.font = "12px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText(value.toString(), width / 2, 15);
			}

			// Draw threshold value text
			if (showThresholdText) {
				ctx.fillStyle = "black";
				ctx.font = "11px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText(`${threshold}`, width / 2, thresholdY - 5);
			}
		}, [
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
			<div className="flex flex-col items-center select-none" ref={containerRef}>
				<div className="text-xs font-medium mb-1 text-center">{label}</div>
				<div className="relative h-full">
					<canvas
						ref={canvasRef}
						className="border border-border rounded bg-white w-[60px] h-full cursor-pointer"
						aria-label={label}
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
					/>
				</div>
			</div>
		);
	},
);

export default SensorBar;
export { maxSensorVal };
