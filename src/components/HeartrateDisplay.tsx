import { Heart } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type HeartrateCurrentDisplayProps = {
	heartrate: number | null;
	animateHeartbeat: boolean;
	showBpmText: boolean;
	isLive: boolean;
	statusText?: string;
	showHeartVisual?: boolean;
	showBorder?: boolean;
	heartColor?: string;
	heartBackgroundColor?: string;
	textColor?: string;
};

export interface HeartrateSample {
	heartrate: number;
	timestamp: number;
}

export type HeartrateHistoryAxisSide = "left" | "right";

type HeartrateHistoryGraphProps = {
	samples: HeartrateSample[];
	timeWindowSeconds: number;
	emptyMessage?: string;
	showBorder?: boolean;
	gradientTopColor?: string;
	gradientBottomColor?: string;
	lineColor?: string;
	smoothLine?: boolean;
	showAxisText?: boolean;
	axisLabelSide?: HeartrateHistoryAxisSide;
	axisTextColor?: string;
	axisTextGap?: number;
};

const HEARTBEAT_STYLE_ID = "heartrate-obs-animation";
const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 320;
const MIN_RENDER_POINTS = 56;
const MAX_RENDER_POINTS = 180;
const DEFAULT_HEARTRATE_BORDER_COLOR = "rgba(255, 255, 255, 0.12)";
const DEFAULT_HEART_COLOR = "rgba(239, 68, 68, 1)";
const DEFAULT_HEART_BACKGROUND_COLOR = "rgba(239, 68, 68, 0.12)";
const DEFAULT_TEXT_COLOR = "rgba(255, 255, 255, 1)";
const DEFAULT_HISTORY_GRADIENT_TOP_COLOR = "rgba(248, 113, 113, 0.35)";
const DEFAULT_HISTORY_GRADIENT_BOTTOM_COLOR = "rgba(248, 113, 113, 0)";
const DEFAULT_HISTORY_LINE_COLOR = "rgba(248, 113, 113, 1)";
const DEFAULT_HISTORY_AXIS_TEXT_COLOR = "rgba(255, 255, 255, 0.72)";
const DEFAULT_HISTORY_AXIS_SIDE: HeartrateHistoryAxisSide = "right";
const DEFAULT_HISTORY_AXIS_TEXT_GAP = 30;
const AXIS_LABEL_EDGE_INSET_Y = 16;
const CURRENT_DISPLAY_PADDING = 28;
const CURRENT_DISPLAY_RADIUS = 36;
const CURRENT_DISPLAY_CONTENT_GAP = 28;
const CURRENT_DISPLAY_SECTION_GAP = 26;
const CURRENT_DISPLAY_HEART_SHELL_SIZE = 160;
const CURRENT_DISPLAY_HEART_ICON_SIZE = 84;
const CURRENT_DISPLAY_BPM_FONT_SIZE = 220;
const CURRENT_DISPLAY_BPM_LABEL_FONT_SIZE = 24;
const CURRENT_DISPLAY_STATUS_FONT_SIZE = 22;
const CURRENT_DISPLAY_STATUS_MAX_WIDTH = 680;

function buildSmoothedSamples(samples: HeartrateSample[], startTime: number, endTime: number): HeartrateSample[] {
	if (samples.length === 0) return [];
	if (samples.length === 1) return [{ heartrate: samples[0].heartrate, timestamp: samples[0].timestamp }];

	const duration = Math.max(1, endTime - startTime);
	const pointCount = Math.min(MAX_RENDER_POINTS, Math.max(MIN_RENDER_POINTS, Math.round(duration / 500)));
	const sigma = Math.min(5000, Math.max(500, duration * 0.05));
	const smoothed: HeartrateSample[] = [];
	let previousValue = samples[0].heartrate;
	const blend = Math.min(0.82, Math.max(0.35, duration / 30000));

	for (let index = 0; index < pointCount; index++) {
		const progress = pointCount === 1 ? 1 : index / (pointCount - 1);
		const timestamp = startTime + progress * duration;
		let weightedTotal = 0;
		let totalWeight = 0;

		for (const sample of samples) {
			const distance = sample.timestamp - timestamp;
			if (distance > 0 || Math.abs(distance) > sigma * 3) continue;

			const weight = Math.exp(-0.5 * (distance / sigma) ** 2);
			weightedTotal += sample.heartrate * weight;
			totalWeight += weight;
		}

		const nearestSample = samples.reduce((closest, sample) => {
			if (sample.timestamp > timestamp) return closest;
			const closestDistance = Math.abs(closest.timestamp - timestamp);
			const sampleDistance = Math.abs(sample.timestamp - timestamp);
			return sampleDistance < closestDistance ? sample : closest;
		}, samples[0]);

		const rawValue = totalWeight > 0 ? weightedTotal / totalWeight : nearestSample.heartrate;
		const easedValue = index === 0 ? rawValue : previousValue * blend + rawValue * (1 - blend);
		previousValue = easedValue;

		smoothed.push({
			heartrate: easedValue,
			timestamp,
		});
	}

	return smoothed;
}

function useScaleToFit() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [scale, setScale] = useState(1);

	useLayoutEffect(() => {
		const container = containerRef.current;
		const content = contentRef.current;
		if (!container || !content) return;

		let frameId = 0;
		const updateScale = () => {
			cancelAnimationFrame(frameId);
			frameId = window.requestAnimationFrame(() => {
				const containerWidth = container.clientWidth;
				const containerHeight = container.clientHeight;
				const contentWidth = content.offsetWidth;
				const contentHeight = content.offsetHeight;

				if (containerWidth <= 0 || containerHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
					setScale(1);
					return;
				}

				const nextScale = Math.min(containerWidth / contentWidth, containerHeight / contentHeight);
				setScale((previousScale) => (Math.abs(previousScale - nextScale) < 0.001 ? previousScale : nextScale));
			});
		};

		updateScale();
		if (typeof ResizeObserver === "undefined") {
			return () => {
				cancelAnimationFrame(frameId);
			};
		}

		const resizeObserver = new ResizeObserver(updateScale);

		resizeObserver.observe(container);
		resizeObserver.observe(content);

		return () => {
			cancelAnimationFrame(frameId);
			resizeObserver.disconnect();
		};
	}, []);

	return {
		containerRef,
		contentRef,
		scale,
	};
}

export function HeartrateCurrentDisplay({
	heartrate,
	animateHeartbeat,
	showBpmText,
	isLive,
	statusText,
	showHeartVisual = true,
	showBorder = false,
	heartColor = DEFAULT_HEART_COLOR,
	heartBackgroundColor = DEFAULT_HEART_BACKGROUND_COLOR,
	textColor = DEFAULT_TEXT_COLOR,
}: HeartrateCurrentDisplayProps) {
	const animationDuration =
		!heartrate || !animateHeartbeat
			? undefined
			: {
					animation: `heartbeat ${Math.max(300, (60 / heartrate) * 1000)}ms ease-in-out infinite`,
				};
	const { containerRef, contentRef, scale } = useScaleToFit();

	useEffect(() => {
		if (document.getElementById(HEARTBEAT_STYLE_ID)) return;

		const style = document.createElement("style");
		style.id = HEARTBEAT_STYLE_ID;
		style.textContent = `
			@keyframes heartbeat {
				0%, 100% { transform: scale(1); }
				15% { transform: scale(1.14); }
				30% { transform: scale(1); }
				45% { transform: scale(1.1); }
				60% { transform: scale(1); }
			}
		`;
		document.head.appendChild(style);
	}, []);

	return (
		<div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-hidden">
			<div
				ref={contentRef}
				className="inline-flex flex-col justify-center bg-black/35 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-md"
				style={{
					border: showBorder ? `1px solid ${DEFAULT_HEARTRATE_BORDER_COLOR}` : "none",
					borderRadius: CURRENT_DISPLAY_RADIUS,
					padding: CURRENT_DISPLAY_PADDING,
					transform: `scale(${scale})`,
					transformOrigin: "center center",
				}}
			>
				<div className="flex flex-1 flex-col items-center justify-center text-center" style={{ gap: CURRENT_DISPLAY_SECTION_GAP }}>
					<div className="flex items-center justify-center" style={{ gap: showHeartVisual ? CURRENT_DISPLAY_CONTENT_GAP : 0 }}>
						{showHeartVisual ? (
							<div
								className="flex shrink-0 items-center justify-center rounded-full"
								style={{
									backgroundColor: heartBackgroundColor,
									height: CURRENT_DISPLAY_HEART_SHELL_SIZE,
									width: CURRENT_DISPLAY_HEART_SHELL_SIZE,
								}}
							>
								<div
									style={{
										...animationDuration,
										color: heartColor,
										opacity: isLive ? 1 : 0.45,
									}}
								>
									<Heart
										fill="currentColor"
										style={{ height: CURRENT_DISPLAY_HEART_ICON_SIZE, width: CURRENT_DISPLAY_HEART_ICON_SIZE }}
									/>
								</div>
							</div>
						) : null}
						<div style={{ color: textColor }}>
							<div
								className="font-semibold leading-none tracking-tight tabular-nums"
								style={{ fontSize: CURRENT_DISPLAY_BPM_FONT_SIZE }}
							>
								{heartrate ?? "--"}
							</div>
							{showBpmText && (
								<div
									className="mt-2 font-medium uppercase tracking-[0.28em]"
									style={{ fontSize: CURRENT_DISPLAY_BPM_LABEL_FONT_SIZE, opacity: 0.68 }}
								>
									BPM
								</div>
							)}
						</div>
					</div>
					{statusText && (
						<p
							className="text-balance"
							style={{
								color: textColor,
								fontSize: CURRENT_DISPLAY_STATUS_FONT_SIZE,
								maxWidth: CURRENT_DISPLAY_STATUS_MAX_WIDTH,
								opacity: 0.68,
							}}
						>
							{statusText}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

export function HeartrateHistoryGraph({
	samples,
	timeWindowSeconds,
	emptyMessage = "Waiting for heartrate data...",
	showBorder = false,
	gradientTopColor = DEFAULT_HISTORY_GRADIENT_TOP_COLOR,
	gradientBottomColor = DEFAULT_HISTORY_GRADIENT_BOTTOM_COLOR,
	lineColor = DEFAULT_HISTORY_LINE_COLOR,
	smoothLine = true,
	showAxisText = true,
	axisLabelSide = DEFAULT_HISTORY_AXIS_SIDE,
	axisTextColor = DEFAULT_HISTORY_AXIS_TEXT_COLOR,
	axisTextGap = DEFAULT_HISTORY_AXIS_TEXT_GAP,
}: HeartrateHistoryGraphProps) {
	const gradientId = useId();
	const timeWindowMs = Math.max(1000, timeWindowSeconds * 1000);
	const latestIncomingSample = samples.length > 0 ? samples[samples.length - 1] : null;
	const [currentTime, setCurrentTime] = useState(() => Date.now());
	const [lockedBounds, setLockedBounds] = useState<{ min: number; max: number } | null>(null);

	useEffect(() => {
		setCurrentTime(Date.now());
		if (!latestIncomingSample) return;

		const intervalId = window.setInterval(() => {
			setCurrentTime(Date.now());
		}, 250);

		return () => window.clearInterval(intervalId);
	}, [latestIncomingSample?.timestamp]);

	useEffect(() => {
		setLockedBounds(null);
	}, [timeWindowMs]);

	const cutoffTime = currentTime - timeWindowMs;
	const visibleSamples = samples.filter((sample) => sample.timestamp >= cutoffTime);
	let stableBounds: { min: number; max: number } | null = null;
	let chartPoints: Array<{ x: number; y: number }> = [];
	const resolvedAxisTextGap = Math.max(0, axisTextGap);
	const axisGutter = showAxisText ? resolvedAxisTextGap : 0;
	const chartStartX = axisLabelSide === "left" ? axisGutter : 0;
	const chartEndX = axisLabelSide === "right" ? GRAPH_WIDTH - axisGutter : GRAPH_WIDTH;
	const innerWidth = Math.max(1, chartEndX - chartStartX);
	const innerHeight = GRAPH_HEIGHT;

	if (visibleSamples.length > 0) {
		let sampleBeforeWindow: HeartrateSample | null = null;
		for (let index = samples.length - 1; index >= 0; index--) {
			if (samples[index].timestamp < cutoffTime) {
				sampleBeforeWindow = samples[index];
				break;
			}
		}

		const windowSamples =
			sampleBeforeWindow && visibleSamples[0].timestamp > cutoffTime
				? [
						{
							heartrate:
								visibleSamples[0].timestamp === sampleBeforeWindow.timestamp
									? visibleSamples[0].heartrate
									: sampleBeforeWindow.heartrate +
										((visibleSamples[0].heartrate - sampleBeforeWindow.heartrate) * (cutoffTime - sampleBeforeWindow.timestamp)) /
											(visibleSamples[0].timestamp - sampleBeforeWindow.timestamp),
							timestamp: cutoffTime,
						},
						...visibleSamples,
					]
				: visibleSamples;

		const firstSampleTime = windowSamples[0].timestamp;
		const renderStartTime = Math.max(cutoffTime, firstSampleTime);
		const renderedSamples = smoothLine
			? buildSmoothedSamples(windowSamples, renderStartTime, currentTime)
			: windowSamples.map((sample) => ({
					heartrate: sample.heartrate,
					timestamp: Math.max(renderStartTime, sample.timestamp),
				}));
		const values = renderedSamples.map((sample) => sample.heartrate);
		const rawMin = Math.min(...values);
		const rawMax = Math.max(...values);
		const yPadding = Math.max(6, Math.round((rawMax - rawMin || 12) * 0.25));
		const nextBounds = {
			min: Math.max(35, rawMin - yPadding),
			max: Math.min(220, rawMax + yPadding),
		};
		stableBounds = lockedBounds
			? {
					min: Math.min(lockedBounds.min, nextBounds.min),
					max: Math.max(lockedBounds.max, nextBounds.max),
				}
			: nextBounds;
		const activeBounds = stableBounds;

		const valueRange = Math.max(1, activeBounds.max - activeBounds.min);
		chartPoints = renderedSamples.map((sample) => {
			const x = chartStartX + ((sample.timestamp - cutoffTime) / Math.max(1, timeWindowMs)) * innerWidth;
			const normalized = (sample.heartrate - activeBounds.min) / valueRange;
			const y = GRAPH_HEIGHT - normalized * innerHeight;
			return { x, y };
		});
	}

	useEffect(() => {
		if (!stableBounds) return;

		setLockedBounds((prev) => {
			if (!prev) return stableBounds;
			if (prev.min === stableBounds.min && prev.max === stableBounds.max) return prev;
			return stableBounds;
		});
	}, [stableBounds?.max, stableBounds?.min]);

	if (!stableBounds) {
		return (
			<div
				className="flex h-full w-full items-center justify-center rounded-[28px] bg-black/35 p-8 text-center text-white/60 backdrop-blur-md"
				style={{
					border: showBorder ? `1px solid ${DEFAULT_HEARTRATE_BORDER_COLOR}` : "none",
				}}
			>
				{emptyMessage}
			</div>
		);
	}

	const getSmoothLinePath = (points: Array<{ x: number; y: number }>) => {
		if (points.length === 0) return "";
		if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

		let path = `M ${points[0].x} ${points[0].y}`;
		for (let index = 1; index < points.length - 1; index++) {
			const currentPoint = points[index];
			const nextPoint = points[index + 1];
			const controlX = currentPoint.x;
			const controlY = currentPoint.y;
			const midpointX = (currentPoint.x + nextPoint.x) / 2;
			const midpointY = (currentPoint.y + nextPoint.y) / 2;
			path += ` Q ${controlX} ${controlY}, ${midpointX} ${midpointY}`;
		}

		const penultimatePoint = points[points.length - 2];
		const lastPoint = points[points.length - 1];
		path += ` Q ${penultimatePoint.x} ${penultimatePoint.y}, ${lastPoint.x} ${lastPoint.y}`;
		return path;
	};

	const linePath = getSmoothLinePath(chartPoints);
	const firstPoint = chartPoints[0];
	const lastPoint = chartPoints[chartPoints.length - 1];
	const areaPath = chartPoints.length < 2 ? "" : `${linePath} L ${lastPoint.x} ${GRAPH_HEIGHT} L ${firstPoint.x} ${GRAPH_HEIGHT} Z`;
	const axisLabelX = axisLabelSide === "left" ? 0 : GRAPH_WIDTH;
	const axisLabelAnchor = axisLabelSide === "left" ? "start" : "end";
	const axisLabelTop = Math.round(stableBounds.max).toString();
	const axisLabelBottom = Math.round(stableBounds.min).toString();

	return (
		<div
			className="h-full w-full overflow-hidden rounded-[28px] bg-black/35 text-white shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-md"
			style={{
				border: showBorder ? `1px solid ${DEFAULT_HEARTRATE_BORDER_COLOR}` : "none",
			}}
		>
			<svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} className="block h-full w-full" preserveAspectRatio="none" aria-hidden>
				<defs>
					<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stopColor={gradientTopColor} />
						<stop offset="100%" stopColor={gradientBottomColor} />
					</linearGradient>
				</defs>

				{chartPoints.length >= 2 && <path d={areaPath} fill={`url(#${gradientId})`} />}
				{chartPoints.length >= 2 && (
					<path d={linePath} fill="none" stroke={lineColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
				)}
				{showAxisText ? (
					<>
						<text
							x={axisLabelX}
							y={AXIS_LABEL_EDGE_INSET_Y}
							fill={axisTextColor}
							fontSize="18"
							fontWeight="600"
							letterSpacing="0.04em"
							textAnchor={axisLabelAnchor}
							dominantBaseline="hanging"
						>
							{axisLabelTop}
						</text>
						<text
							x={axisLabelX}
							y={GRAPH_HEIGHT - AXIS_LABEL_EDGE_INSET_Y}
							fill={axisTextColor}
							fontSize="18"
							fontWeight="600"
							letterSpacing="0.04em"
							textAnchor={axisLabelAnchor}
							dominantBaseline="text-after-edge"
						>
							{axisLabelBottom}
						</text>
					</>
				) : null}
			</svg>
		</div>
	);
}
