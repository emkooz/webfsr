import { create } from "zustand";

interface DataState {
	numSensors: number;
	setNumSensors: (count: number) => void;
}

export const useDataStore = create<DataState>((set) => ({
	numSensors: 0,
	setNumSensors: (count) => set({ numSensors: count }),
}));

export const useSensorCount = () => {
	return useDataStore((state) => state.numSensors);
};
