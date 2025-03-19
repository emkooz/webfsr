import { useRef, useCallback, useEffect, memo } from "react";
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
}

// Component for time-series graph
const TimeSeriesGraph = memo(
	({
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
	}: TimeSeriesGraphProps) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);
		const timeSeriesDataRef = useRef<Array<Array<{ value: number; timestamp: number }>>>([]);
		const requestIdRef = useRef<number | null>(null);

		// Update time series data when new values come in
		useEffect(() => {
			if (!latestData) return;

			// Initialize data structure if needed
			if (timeSeriesDataRef.current.length === 0)
				timeSeriesDataRef.current = Array.from({ length: latestData.values.length }, () => []);

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

		const drawGraph = useCallback(() => {
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

			// Draw background grid
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

				// Horizontal grid lines
				for (let i = 0; i <= 5; i++) {
					const y = (i / 5) * height;
					ctx.beginPath();
					ctx.moveTo(0, y);
					ctx.lineTo(width, y);
					ctx.stroke();

					// Draw value labels
					const value = Math.round(maxSensorVal * (1 - i / 5));
					ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
					ctx.font = "10px sans-serif";
					ctx.textAlign = "left";
					ctx.fillText(value.toString(), 5, y + 10);
				}
			}

			const timeSeriesData = timeSeriesDataRef.current;
			const currentTime = Date.now();

			// Draw threshold lines
			if (showThresholdLines) {
				thresholds.forEach((threshold, sensorIndex) => {
					if (sensorIndex >= sensorColors.length) return;

					const baseColor = sensorColors[sensorIndex];
					// Convert hex to rgba with the specified opacity
					const thresholdColor = `rgba(${Number.parseInt(baseColor.slice(1, 3), 16)}, ${Number.parseInt(baseColor.slice(3, 5), 16)}, ${Number.parseInt(baseColor.slice(5, 7), 16)}, ${thresholdLineOpacity})`;

					const y = height - (threshold / maxSensorVal) * height;

					ctx.beginPath();
					ctx.moveTo(0, y);
					ctx.lineTo(width, y);
					ctx.strokeStyle = thresholdColor;
					ctx.lineWidth = 2;
					ctx.stroke();
				});
			}

			// Draw data lines for each sensor
			if (timeSeriesData.some((sensor) => sensor.length > 0)) {
				timeSeriesData.forEach((sensorData, sensorIndex) => {
					if (!sensorData || !sensorData.length) return;
					if (sensorData.length === 0) return;

					// Ensure we stay within the color array bounds
					const colorIndex = sensorIndex % sensorColors.length;
					ctx.strokeStyle = sensorColors[colorIndex];
					ctx.lineWidth = 2;
					ctx.beginPath();

					// Map timestamps to x positions
					sensorData.forEach((dataPoint, index) => {
						// Calculate x position based on timestamp relative to time window
						const x = width - ((currentTime - dataPoint.timestamp) / timeWindow) * width;
						const y = height - (dataPoint.value / maxSensorVal) * height;

						if (index === 0) {
							ctx.moveTo(x, y);
						} else {
							ctx.lineTo(x, y);
						}
					});

					ctx.stroke();
				});
			} else {
				// Draw a message when no data is available
				ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
				ctx.font = "14px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText("Waiting for data...", width / 2, height / 2);
			}

			// Draw legend
			if (showLegend) {
				ctx.font = "12px sans-serif";
				const legendY = 25;
				const legendSpacing = Math.min(80, width / 8);

				sensorColors.forEach((color, index) => {
					if (index >= sensorLabels.length) return;

					const legendX = 10 + index * legendSpacing;

					// Draw color box
					ctx.fillStyle = color;
					ctx.fillRect(legendX, legendY - 10, 12, 12);

					// Draw sensor text
					ctx.fillStyle = "black";
					ctx.textAlign = "left";
					ctx.fillText(sensorLabels[index], legendX + 15, legendY);
				});
			}
		}, [
			timeWindow,
			thresholds,
			sensorLabels,
			sensorColors,
			showGridLines,
			showThresholdLines,
			thresholdLineOpacity,
			showLegend,
		]);

		const handleResize = useCallback(() => {
			// Cancel any pending animation frame
			if (requestIdRef.current !== null) cancelAnimationFrame(requestIdRef.current);

			// Schedule a new draw
			requestIdRef.current = requestAnimationFrame(drawGraph);
		}, [drawGraph]);

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
					className={`w-full h-full bg-white ${showBorder ? "border border-border rounded" : ""}`}
					aria-label="Time series graph of sensor values"
				/>
			</div>
		);
	},
);

export default TimeSeriesGraph;
