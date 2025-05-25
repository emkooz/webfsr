import { create } from "zustand";
import { DEFAULT_PROFILE } from "~/lib/useProfileManager";

interface SettingsState {
	// Colors
	sensorColors: string[];
	singleBarColor: string;
	thresholdColor: string;
	graphActivationColor: string;

	// Bar visualization
	showBarThresholdText: boolean;
	showBarValueText: boolean;
	useThresholdColor: boolean;
	useSingleColor: boolean;
	useBarGradient: boolean;

	// Graph visualization
	showGridLines: boolean;
	showThresholdLines: boolean;
	thresholdLineOpacity: number;
	showLegend: boolean;
	showGraphBorder: boolean;
	showGraphActivation: boolean;
	timeWindow: number;

	// Heartrate monitor
	showHeartrateMonitor: boolean;
	verticalAlignHeartrate: boolean;
	fillHeartIcon: boolean;
	showBpmText: boolean;
	animateHeartbeat: boolean;

	// General settings
	lockThresholds: boolean;
	pollingRate: number;
	useUnthrottledPolling: boolean;

	// Actions
	setSensorColors: (colors: string[]) => void;
	setSingleBarColor: (color: string) => void;
	setThresholdColor: (color: string) => void;
	setGraphActivationColor: (color: string) => void;

	setShowBarThresholdText: (show: boolean) => void;
	setShowBarValueText: (show: boolean) => void;
	setUseThresholdColor: (use: boolean) => void;
	setUseSingleColor: (use: boolean) => void;
	setUseBarGradient: (use: boolean) => void;

	setShowGridLines: (show: boolean) => void;
	setShowThresholdLines: (show: boolean) => void;
	setThresholdLineOpacity: (opacity: number) => void;
	setShowLegend: (show: boolean) => void;
	setShowGraphBorder: (show: boolean) => void;
	setShowGraphActivation: (show: boolean) => void;
	setTimeWindow: (time: number) => void;

	setShowHeartrateMonitor: (show: boolean) => void;
	setVerticalAlignHeartrate: (align: boolean) => void;
	setFillHeartIcon: (fill: boolean) => void;
	setShowBpmText: (show: boolean) => void;
	setAnimateHeartbeat: (animate: boolean) => void;

	setLockThresholds: (lock: boolean) => void;
	setPollingRate: (rate: number) => void;
	setUseUnthrottledPolling: (use: boolean) => void;

	// Bulk actions
	updateAllSettings: (settings: Partial<SettingsState>) => void;
	resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
	// Initial state from DEFAULT_PROFILE
	sensorColors: DEFAULT_PROFILE.sensorColors,
	singleBarColor: DEFAULT_PROFILE.singleBarColor,
	thresholdColor: DEFAULT_PROFILE.thresholdColor,
	graphActivationColor: DEFAULT_PROFILE.graphActivationColor,

	showBarThresholdText: DEFAULT_PROFILE.showBarThresholdText,
	showBarValueText: DEFAULT_PROFILE.showBarValueText,
	useThresholdColor: DEFAULT_PROFILE.useThresholdColor,
	useSingleColor: DEFAULT_PROFILE.useSingleColor,
	useBarGradient: DEFAULT_PROFILE.useBarGradient,

	showGridLines: DEFAULT_PROFILE.showGridLines,
	showThresholdLines: DEFAULT_PROFILE.showThresholdLines,
	thresholdLineOpacity: DEFAULT_PROFILE.thresholdLineOpacity,
	showLegend: DEFAULT_PROFILE.showLegend,
	showGraphBorder: DEFAULT_PROFILE.showGraphBorder,
	showGraphActivation: DEFAULT_PROFILE.showGraphActivation,
	timeWindow: DEFAULT_PROFILE.timeWindow,

	showHeartrateMonitor: DEFAULT_PROFILE.showHeartrateMonitor,
	verticalAlignHeartrate: DEFAULT_PROFILE.verticalAlignHeartrate,
	fillHeartIcon: DEFAULT_PROFILE.fillHeartIcon,
	showBpmText: DEFAULT_PROFILE.showBpmText,
	animateHeartbeat: DEFAULT_PROFILE.animateHeartbeat,

	lockThresholds: DEFAULT_PROFILE.lockThresholds,
	pollingRate: DEFAULT_PROFILE.pollingRate,
	useUnthrottledPolling: DEFAULT_PROFILE.useUnthrottledPolling,

	// Individual setters
	setSensorColors: (colors) => set({ sensorColors: colors }),
	setSingleBarColor: (color) => set({ singleBarColor: color }),
	setThresholdColor: (color) => set({ thresholdColor: color }),
	setGraphActivationColor: (color) => set({ graphActivationColor: color }),

	setShowBarThresholdText: (show) => set({ showBarThresholdText: show }),
	setShowBarValueText: (show) => set({ showBarValueText: show }),
	setUseThresholdColor: (use) => set({ useThresholdColor: use }),
	setUseSingleColor: (use) => set({ useSingleColor: use }),
	setUseBarGradient: (use) => set({ useBarGradient: use }),

	setShowGridLines: (show) => set({ showGridLines: show }),
	setShowThresholdLines: (show) => set({ showThresholdLines: show }),
	setThresholdLineOpacity: (opacity) => set({ thresholdLineOpacity: opacity }),
	setShowLegend: (show) => set({ showLegend: show }),
	setShowGraphBorder: (show) => set({ showGraphBorder: show }),
	setShowGraphActivation: (show) => set({ showGraphActivation: show }),
	setTimeWindow: (time) => set({ timeWindow: time }),

	setShowHeartrateMonitor: (show) => set({ showHeartrateMonitor: show }),
	setVerticalAlignHeartrate: (align) => set({ verticalAlignHeartrate: align }),
	setFillHeartIcon: (fill) => set({ fillHeartIcon: fill }),
	setShowBpmText: (show) => set({ showBpmText: show }),
	setAnimateHeartbeat: (animate) => set({ animateHeartbeat: animate }),

	setLockThresholds: (lock) => set({ lockThresholds: lock }),
	setPollingRate: (rate) => set({ pollingRate: rate }),
	setUseUnthrottledPolling: (use) => set({ useUnthrottledPolling: use }),

	// Bulk actions
	updateAllSettings: (settings) => set(settings),
	resetToDefaults: () =>
		set({
			sensorColors: DEFAULT_PROFILE.sensorColors,
			singleBarColor: DEFAULT_PROFILE.singleBarColor,
			thresholdColor: DEFAULT_PROFILE.thresholdColor,
			graphActivationColor: DEFAULT_PROFILE.graphActivationColor,

			showBarThresholdText: DEFAULT_PROFILE.showBarThresholdText,
			showBarValueText: DEFAULT_PROFILE.showBarValueText,
			useThresholdColor: DEFAULT_PROFILE.useThresholdColor,
			useSingleColor: DEFAULT_PROFILE.useSingleColor,
			useBarGradient: DEFAULT_PROFILE.useBarGradient,

			showGridLines: DEFAULT_PROFILE.showGridLines,
			showThresholdLines: DEFAULT_PROFILE.showThresholdLines,
			thresholdLineOpacity: DEFAULT_PROFILE.thresholdLineOpacity,
			showLegend: DEFAULT_PROFILE.showLegend,
			showGraphBorder: DEFAULT_PROFILE.showGraphBorder,
			showGraphActivation: DEFAULT_PROFILE.showGraphActivation,
			timeWindow: DEFAULT_PROFILE.timeWindow,

			showHeartrateMonitor: DEFAULT_PROFILE.showHeartrateMonitor,
			verticalAlignHeartrate: DEFAULT_PROFILE.verticalAlignHeartrate,
			fillHeartIcon: DEFAULT_PROFILE.fillHeartIcon,
			showBpmText: DEFAULT_PROFILE.showBpmText,
			animateHeartbeat: DEFAULT_PROFILE.animateHeartbeat,

			lockThresholds: DEFAULT_PROFILE.lockThresholds,
			pollingRate: DEFAULT_PROFILE.pollingRate,
			useUnthrottledPolling: DEFAULT_PROFILE.useUnthrottledPolling,
		}),
}));

// Color settings selectors
export const useColorSettings = () => {
	const sensorColors = useSettingsStore((state) => state.sensorColors);
	const setSensorColors = useSettingsStore((state) => state.setSensorColors);
	const singleBarColor = useSettingsStore((state) => state.singleBarColor);
	const setSingleBarColor = useSettingsStore((state) => state.setSingleBarColor);
	const thresholdColor = useSettingsStore((state) => state.thresholdColor);
	const setThresholdColor = useSettingsStore((state) => state.setThresholdColor);
	const graphActivationColor = useSettingsStore((state) => state.graphActivationColor);
	const setGraphActivationColor = useSettingsStore((state) => state.setGraphActivationColor);

	return {
		sensorColors,
		setSensorColors,
		singleBarColor,
		setSingleBarColor,
		thresholdColor,
		setThresholdColor,
		graphActivationColor,
		setGraphActivationColor,
	};
};

// Bar visualization settings selectors
export const useBarVisualizationSettings = () => {
	const showBarThresholdText = useSettingsStore((state) => state.showBarThresholdText);
	const setShowBarThresholdText = useSettingsStore((state) => state.setShowBarThresholdText);
	const showBarValueText = useSettingsStore((state) => state.showBarValueText);
	const setShowBarValueText = useSettingsStore((state) => state.setShowBarValueText);
	const useThresholdColor = useSettingsStore((state) => state.useThresholdColor);
	const setUseThresholdColor = useSettingsStore((state) => state.setUseThresholdColor);
	const useSingleColor = useSettingsStore((state) => state.useSingleColor);
	const setUseSingleColor = useSettingsStore((state) => state.setUseSingleColor);
	const useBarGradient = useSettingsStore((state) => state.useBarGradient);
	const setUseBarGradient = useSettingsStore((state) => state.setUseBarGradient);

	return {
		showBarThresholdText,
		setShowBarThresholdText,
		showBarValueText,
		setShowBarValueText,
		useThresholdColor,
		setUseThresholdColor,
		useSingleColor,
		setUseSingleColor,
		useBarGradient,
		setUseBarGradient,
	};
};

// Graph visualization settings selectors
export const useGraphVisualizationSettings = () => {
	const showGridLines = useSettingsStore((state) => state.showGridLines);
	const setShowGridLines = useSettingsStore((state) => state.setShowGridLines);
	const showThresholdLines = useSettingsStore((state) => state.showThresholdLines);
	const setShowThresholdLines = useSettingsStore((state) => state.setShowThresholdLines);
	const thresholdLineOpacity = useSettingsStore((state) => state.thresholdLineOpacity);
	const setThresholdLineOpacity = useSettingsStore((state) => state.setThresholdLineOpacity);
	const showLegend = useSettingsStore((state) => state.showLegend);
	const setShowLegend = useSettingsStore((state) => state.setShowLegend);
	const showGraphBorder = useSettingsStore((state) => state.showGraphBorder);
	const setShowGraphBorder = useSettingsStore((state) => state.setShowGraphBorder);
	const showGraphActivation = useSettingsStore((state) => state.showGraphActivation);
	const setShowGraphActivation = useSettingsStore((state) => state.setShowGraphActivation);
	const timeWindow = useSettingsStore((state) => state.timeWindow);
	const setTimeWindow = useSettingsStore((state) => state.setTimeWindow);

	return {
		showGridLines,
		setShowGridLines,
		showThresholdLines,
		setShowThresholdLines,
		thresholdLineOpacity,
		setThresholdLineOpacity,
		showLegend,
		setShowLegend,
		showGraphBorder,
		setShowGraphBorder,
		showGraphActivation,
		setShowGraphActivation,
		timeWindow,
		setTimeWindow,
	};
};

// Heartrate settings selectors
export const useHeartrateSettings = () => {
	const showHeartrateMonitor = useSettingsStore((state) => state.showHeartrateMonitor);
	const setShowHeartrateMonitor = useSettingsStore((state) => state.setShowHeartrateMonitor);
	const verticalAlignHeartrate = useSettingsStore((state) => state.verticalAlignHeartrate);
	const setVerticalAlignHeartrate = useSettingsStore((state) => state.setVerticalAlignHeartrate);
	const fillHeartIcon = useSettingsStore((state) => state.fillHeartIcon);
	const setFillHeartIcon = useSettingsStore((state) => state.setFillHeartIcon);
	const showBpmText = useSettingsStore((state) => state.showBpmText);
	const setShowBpmText = useSettingsStore((state) => state.setShowBpmText);
	const animateHeartbeat = useSettingsStore((state) => state.animateHeartbeat);
	const setAnimateHeartbeat = useSettingsStore((state) => state.setAnimateHeartbeat);

	return {
		showHeartrateMonitor,
		setShowHeartrateMonitor,
		verticalAlignHeartrate,
		setVerticalAlignHeartrate,
		fillHeartIcon,
		setFillHeartIcon,
		showBpmText,
		setShowBpmText,
		animateHeartbeat,
		setAnimateHeartbeat,
	};
};

// General settings selectors
export const useGeneralSettings = () => {
	const lockThresholds = useSettingsStore((state) => state.lockThresholds);
	const setLockThresholds = useSettingsStore((state) => state.setLockThresholds);
	const pollingRate = useSettingsStore((state) => state.pollingRate);
	const setPollingRate = useSettingsStore((state) => state.setPollingRate);
	const useUnthrottledPolling = useSettingsStore((state) => state.useUnthrottledPolling);
	const setUseUnthrottledPolling = useSettingsStore((state) => state.setUseUnthrottledPolling);

	return {
		lockThresholds,
		setLockThresholds,
		pollingRate,
		setPollingRate,
		useUnthrottledPolling,
		setUseUnthrottledPolling,
	};
};

// Bulk actions
export const useSettingsBulkActions = () => {
	const updateAllSettings = useSettingsStore((state) => state.updateAllSettings);
	const resetToDefaults = useSettingsStore((state) => state.resetToDefaults);

	const state = useSettingsStore();

	const getAllSettings = () => ({
		sensorColors: state.sensorColors,
		showBarThresholdText: state.showBarThresholdText,
		showBarValueText: state.showBarValueText,
		thresholdColor: state.thresholdColor,
		useThresholdColor: state.useThresholdColor,
		useSingleColor: state.useSingleColor,
		singleBarColor: state.singleBarColor,
		useBarGradient: state.useBarGradient,
		showGridLines: state.showGridLines,
		showThresholdLines: state.showThresholdLines,
		thresholdLineOpacity: state.thresholdLineOpacity,
		showLegend: state.showLegend,
		showGraphBorder: state.showGraphBorder,
		showGraphActivation: state.showGraphActivation,
		graphActivationColor: state.graphActivationColor,
		timeWindow: state.timeWindow,
		showHeartrateMonitor: state.showHeartrateMonitor,
		lockThresholds: state.lockThresholds,
		verticalAlignHeartrate: state.verticalAlignHeartrate,
		fillHeartIcon: state.fillHeartIcon,
		showBpmText: state.showBpmText,
		animateHeartbeat: state.animateHeartbeat,
		pollingRate: state.pollingRate,
		useUnthrottledPolling: state.useUnthrottledPolling,
	});

	return {
		updateAllSettings,
		resetToDefaults,
		getAllSettings,
	};
};
