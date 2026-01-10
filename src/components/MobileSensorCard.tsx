import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";

const maxSensorVal = 1023;

interface MobileSensorCardProps {
	label: string;
	value: number;
	threshold: number;
	color: string;
	thresholdColor: string;
	useThresholdColor: boolean;
	index: number;
	onThresholdChange: (index: number, value: number) => void;
	isLocked?: boolean;
	theme?: "light" | "dark";
}

const MobileSensorCard = ({
	label,
	value,
	threshold,
	color,
	thresholdColor,
	useThresholdColor,
	index,
	onThresholdChange,
	isLocked = false,
	theme,
}: MobileSensorCardProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	const handleAdjust = (step: number) => {
		if (isLocked) return;

		const newValue = Math.max(0, Math.min(threshold + step, maxSensorVal));
		onThresholdChange(index, newValue);
	};

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const updateSize = () => {
			const rect = container.getBoundingClientRect();
			setDimensions({ width: rect.width, height: rect.height });
		};

		updateSize();
		const observer = new ResizeObserver(updateSize);
		observer.observe(container);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const isDarkMode = theme === "dark";
		const dpr = window.devicePixelRatio || 1;
		const width = Math.floor(dimensions.width);
		const height = Math.floor(dimensions.height);

		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		ctx.scale(dpr, dpr);
		ctx.imageSmoothingEnabled = false;

		ctx.clearRect(0, 0, width, height);

		// Background
		ctx.fillStyle = isDarkMode ? "#1a1a1a" : "#fafafa";
		ctx.fillRect(0, 0, width, height);

		// Bar fill (horizontal)
		const activeColor = useThresholdColor && value >= threshold ? thresholdColor : color;
		const barWidth = (value / maxSensorVal) * width;
		ctx.fillStyle = activeColor;
		ctx.fillRect(0, 0, barWidth, height);

		// Threshold marker (vertical line)
		const thresholdX = (threshold / maxSensorVal) * width;
		ctx.beginPath();
		ctx.moveTo(thresholdX, 0);
		ctx.lineTo(thresholdX, height);
		ctx.strokeStyle = "rgba(255, 0, 0, 0.9)";
		ctx.lineWidth = 3;
		ctx.stroke();

		// Border
		ctx.strokeStyle = isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)";
		ctx.lineWidth = 1;
		ctx.strokeRect(0, 0, width, height);
	}, [dimensions, value, threshold, color, thresholdColor, useThresholdColor, theme]);

	return (
		<div className="rounded-xl border border-border bg-card p-4 shadow-sm">
			<div className="mb-3 text-sm font-semibold text-foreground">{label}</div>

			{/* Horizontal bar */}
			<div ref={containerRef} className="h-10 w-full rounded-lg overflow-hidden mb-3">
				<canvas ref={canvasRef} className="w-full h-full" />
			</div>

			{/* Value and threshold display */}
			<div className="flex justify-between text-xs text-muted-foreground mb-4 font-mono tabular-nums">
				<span>Value: {value}</span>
				<span>Threshold: {threshold}</span>
			</div>

			{/* Stepper buttons */}
			<div className="flex gap-2">
				<Button
					variant="outline"
					className="flex-1 h-14 text-lg font-medium active:scale-95 transition-transform"
					onClick={() => handleAdjust(-10)}
					disabled={isLocked || threshold <= 0}
					aria-label={`Decrease threshold by 10 for ${label}`}
				>
					-10
				</Button>
				<Button
					variant="outline"
					className="flex-1 h-14 text-lg font-medium active:scale-95 transition-transform"
					onClick={() => handleAdjust(-1)}
					disabled={isLocked || threshold <= 0}
					aria-label={`Decrease threshold by 1 for ${label}`}
				>
					-1
				</Button>
				<Button
					variant="outline"
					className="flex-1 h-14 text-lg font-medium active:scale-95 transition-transform"
					onClick={() => handleAdjust(1)}
					disabled={isLocked || threshold >= maxSensorVal}
					aria-label={`Increase threshold by 1 for ${label}`}
				>
					+1
				</Button>
				<Button
					variant="outline"
					className="flex-1 h-14 text-lg font-medium active:scale-95 transition-transform"
					onClick={() => handleAdjust(10)}
					disabled={isLocked || threshold >= maxSensorVal}
					aria-label={`Increase threshold by 10 for ${label}`}
				>
					+10
				</Button>
			</div>
		</div>
	);
};

export default MobileSensorCard;
