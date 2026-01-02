import { useSensorCount } from "@/store/dataStore";
import { useEffect, useRef } from "react";
import { maxSensorVal } from "./SensorBar";

interface TimeSeriesGraphProps {
	latestData: { values: number[] } | null;
	timeWindow: number;
	thresholds: number[];
	sensorLabels: string[];
	sensorColors: string[];
	showGridLines: boolean;
	showThresholdLines: boolean;
	thresholdLineOpacity: number;
	showLegend: boolean;
	showBorder: boolean;
	showActivation: boolean;
	activationColor: string;
	showSensorLabels?: boolean;
	sensorLabelColor?: string;
}

// Component for time-series graph
const TimeSeriesGraph = ({
	latestData,
	timeWindow,
	thresholds,
	sensorLabels,
	sensorColors,
	showGridLines,
	showThresholdLines,
	thresholdLineOpacity,
	showLegend,
	showBorder,
	showActivation,
	activationColor,
	showSensorLabels = true,
	sensorLabelColor = "rgba(0, 0, 0, 0.7)",
}: TimeSeriesGraphProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const timeSeriesDataRef = useRef<Array<Array<{ value: number; timestamp: number }>>>([]);
	const requestIdRef = useRef<number | null>(null);
	const numSensors = useSensorCount();

	const parseColor = (c: string): { r: number; g: number; b: number; a: number } => {
		if (!c) return { r: 0, g: 0, b: 0, a: 1 };
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

	// Update time series data when new values come in
	useEffect(() => {
		if (!latestData) return;

		// Initialize data structure
		if (timeSeriesDataRef.current.length === 0) timeSeriesDataRef.current = Array.from({ length: latestData.values.length }, () => []);

		const currentTime = Date.now();

		// Update each sensor with new data
		latestData.values.forEach((value, i) => {
			if (i < timeSeriesDataRef.current.length) {
				const sensor = timeSeriesDataRef.current[i];
				sensor.push({ value, timestamp: currentTime });

				// Clean up old data points outside our time window
				const cutoffTime = currentTime - timeWindow;
				while (sensor.length > 0 && sensor[0].timestamp < cutoffTime) sensor.shift();
			}
		});

		// Only draw if we have new data
		if (requestIdRef.current !== null) cancelAnimationFrame(requestIdRef.current);

		requestIdRef.current = requestAnimationFrame(drawGraph);
	}, [latestData, timeWindow]);

	const drawGraph = () => {
		requestIdRef.current = null;

		const canvas = canvasRef.current;
		if (!canvas) return;

		const container = containerRef.current;
		if (!container) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Manage pixel ratio
		const dpr = window.devicePixelRatio || 1;
		const rect = container.getBoundingClientRect();

		if (rect.width === 0 || rect.height === 0) {
			console.log("Container has zero size, redrawing");
			requestIdRef.current = requestAnimationFrame(drawGraph);
			return;
		}

		canvas.width = rect.width * dpr;
		canvas.height = rect.height * dpr;

		// Clear all transformations first
		ctx.setTransform(1, 0, 0, 1, 0, 0);

		// Scale canvas context
		ctx.scale(dpr, dpr);

		canvas.style.width = `${rect.width}px`;
		canvas.style.height = `${rect.height}px`;

		const width = rect.width;
		const height = rect.height;

		ctx.clearRect(0, 0, width, height);

		const timeSeriesData = timeSeriesDataRef.current;
		const currentTime = Date.now();
		const sensorCount = timeSeriesData.length;

		if (sensorCount === 0) {
			// Draw a message when no data is available
			ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
			ctx.font = "14px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText("Waiting for data...", width / 2, height / 2);
			return;
		}

		// Calculate the height for each sensor row
		const rowHeight = height / sensorCount;
		const rowPadding = 5;
		const effectiveRowHeight = rowHeight - 2 * rowPadding;

		// Draw grid
		if (showGridLines) {
			ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
			ctx.lineWidth = 1;

			// Vertical grid lines
			for (let i = 0; i <= 6; i++) {
				const x = (i / 6) * width;
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, height);
				ctx.stroke();

				// Draw time labels
				ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
				ctx.font = "10px sans-serif";
				ctx.textAlign = "center";
				const timeLabel = Math.round((i / 6) * timeWindow);
				ctx.fillText(`-${timeLabel}ms`, x, height - 5);
			}

			// Horizontal grid lines (sensor rows)
			for (let i = 0; i < sensorCount; i++) {
				const y = i * rowHeight;

				// Draw row divider
				if (i > 0) {
					ctx.beginPath();
					ctx.moveTo(0, y);
					ctx.lineTo(width, y);
					ctx.stroke();
				}

				// Draw min/max value labels for this row
				ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
				ctx.font = "10px sans-serif";
				ctx.textAlign = "left";
				ctx.fillText("0", 5, y + rowHeight - 5);
				ctx.fillText(maxSensorVal.toString(), 5, y + rowPadding + 10);
			}
		}

		// Draw sensor labels
		if (showSensorLabels) {
			for (let i = 0; i < sensorCount; i++) {
				const y = i * rowHeight;

				if (i < sensorLabels.length) {
					ctx.fillStyle = sensorLabelColor;
					ctx.font = "12px sans-serif";
					ctx.textAlign = "right";
					ctx.fillText(sensorLabels[i], width - 10, y + 15);
				}
			}
		}

		// Draw data for each sensor in its own row
		timeSeriesData.forEach((sensorData, sensorIndex) => {
			if (!sensorData || sensorData.length === 0) return;

			// Calculate the y-position for this sensor's row
			const rowY = sensorIndex * rowHeight + rowPadding;

			// Get sensor color
			const colorIndex = sensorIndex % sensorColors.length;
			const sensorColor = sensorColors[colorIndex];
			const threshold = thresholds[sensorIndex] || 0;

			// Draw threshold line for this sensor
			if (showThresholdLines && sensorIndex < thresholds.length) {
				const thresholdY = rowY + effectiveRowHeight - (threshold / maxSensorVal) * effectiveRowHeight;

				// Use the same RGB as sensorColor but apply combined alpha (base color alpha * thresholdLineOpacity)
				const { r, g, b, a } = parseColor(sensorColor);
				const thresholdAlpha = Math.max(0, Math.min(1, a * thresholdLineOpacity));
				const thresholdColor = `rgba(${r}, ${g}, ${b}, ${thresholdAlpha})`;

				ctx.beginPath();
				ctx.moveTo(0, thresholdY);
				ctx.lineTo(width, thresholdY);
				ctx.strokeStyle = thresholdColor;
				ctx.lineWidth = 2;
				ctx.stroke();

				// Draw threshold value number using the sensor color (opaque)
				ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`;
				ctx.font = "10px sans-serif";
				ctx.textAlign = "right";
				ctx.fillText(threshold.toString(), width - 10, thresholdY - 3);
			}

			// Draw sensor data line with activation color for values above threshold
			if (showActivation && threshold > 0) {
				let lastX: number | null = null;
				let lastY: number | null = null;
				let lastAboveThreshold = false;

				// Draw each segment
				sensorData.forEach((dataPoint, index) => {
					const x = width - ((currentTime - dataPoint.timestamp) / timeWindow) * width;
					const normalizedY = effectiveRowHeight - (dataPoint.value / maxSensorVal) * effectiveRowHeight;
					const y = rowY + normalizedY;
					const aboveThreshold = dataPoint.value >= threshold;

					// If this is not the first point and the threshold state changed, we need to end the previous path
					// and start a new one with a different color
					if (index > 0 && lastAboveThreshold !== aboveThreshold && lastX !== null && lastY !== null) {
						// Complete the previous segment
						ctx.lineTo(x, y);
						ctx.stroke();

						// Start a new segment
						ctx.beginPath();
						ctx.moveTo(x, y);
						ctx.strokeStyle = aboveThreshold ? activationColor : sensorColor;
						ctx.lineWidth = 2;
					} else if (index === 0) {
						// Start the first segment
						ctx.beginPath();
						ctx.strokeStyle = aboveThreshold ? activationColor : sensorColor;
						ctx.lineWidth = 2;
						ctx.moveTo(x, y);
					} else {
						// Continue the current segment
						ctx.lineTo(x, y);
					}

					lastX = x;
					lastY = y;
					lastAboveThreshold = aboveThreshold;
				});

				// Finish the last segment
				ctx.stroke();
			} else {
				// Drawing without activation
				ctx.strokeStyle = sensorColor;
				ctx.lineWidth = 2;
				ctx.beginPath();

				sensorData.forEach((dataPoint, index) => {
					// Calculate x position based on timestamp relative to time window
					const x = width - ((currentTime - dataPoint.timestamp) / timeWindow) * width;

					// Calculate y position within this sensor's row
					const normalizedY = effectiveRowHeight - (dataPoint.value / maxSensorVal) * effectiveRowHeight;
					const y = rowY + normalizedY;

					if (index === 0) {
						ctx.moveTo(x, y);
					} else {
						ctx.lineTo(x, y);
					}
				});

				ctx.stroke();
			}
		});

		// Draw legend
		if (showLegend) {
			const legendY = 25;
			const legendSpacing = Math.min(80, width / 8);
			ctx.font = "12px sans-serif";

			Array.from({ length: numSensors }).forEach((_, index) => {
				if (index >= sensorLabels.length) return;

				const legendX = 10 + index * legendSpacing;
				const color = sensorColors[index % sensorColors.length];

				// Draw color box
				ctx.fillStyle = color;
				ctx.fillRect(legendX, legendY - 10, 12, 12);

				// Draw sensor text
				ctx.fillStyle = sensorLabelColor;
				ctx.textAlign = "left";
				ctx.fillText(sensorLabels[index], legendX + 15, legendY);
			});

			if (showActivation) {
				const activationLegendX = 10 + numSensors * legendSpacing;

				// Draw activation color box
				ctx.fillStyle = activationColor;
				ctx.fillRect(activationLegendX, legendY - 10, 12, 12);

				// Draw activation text
				ctx.fillStyle = "black";
				ctx.textAlign = "left";
				ctx.fillText("Activated", activationLegendX + 15, legendY);
			}
		}
	};

	const handleResize = () => {
		// Cancel any pending animation frame
		if (requestIdRef.current !== null) cancelAnimationFrame(requestIdRef.current);

		// Schedule a new draw
		requestIdRef.current = requestAnimationFrame(drawGraph);
	};

	// On mount
	useEffect(() => {
		drawGraph();

		const resizeObserver = new ResizeObserver(() => {
			handleResize();
		});

		if (containerRef.current) resizeObserver.observe(containerRef.current);

		return () => {
			if (containerRef.current) resizeObserver.unobserve(containerRef.current);

			if (requestIdRef.current !== null) cancelAnimationFrame(requestIdRef.current);
		};
	}, [drawGraph, handleResize]);

	return (
		<div className="relative w-full h-full" ref={containerRef}>
			<canvas
				ref={canvasRef}
				className={`w-full h-full bg-transparent ${showBorder ? "border border-border rounded" : ""}`}
				aria-label="Time series graph of sensor values"
			/>
		</div>
	);
};

export default TimeSeriesGraph;
