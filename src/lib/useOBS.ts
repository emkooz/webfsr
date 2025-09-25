import OBSWebSocket from "obs-websocket-js";
import { useEffect, useRef, useState } from "react";

export interface ObsBroadcastPayload {
	values: number[];
	thresholds: number[];
}

// Minimal JSON types compatible with obs-websocket's JsonObject
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type CustomEventHandler = (eventData: ObsBroadcastPayload) => void;

export const useOBS = () => {
	const obsRef = useRef<OBSWebSocket | null>(null);
	const [isConnected, setIsConnected] = useState<boolean>(false);
	const [isConnecting, setIsConnecting] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const getObs = () => {
		if (!obsRef.current) obsRef.current = new OBSWebSocket();
		return obsRef.current;
	};

	const wiredRef = useRef<boolean>(false);

	const connect = async (password: string, url = "ws://127.0.0.1:4455") => {
		const obs = getObs();

		try {
			setIsConnecting(true);
			setError(null);

			// Attach core listeners once
			if (!wiredRef.current) {
				obs.on("ConnectionClosed", () => setIsConnected(false));
				obs.on("Identified", () => setIsConnected(true));
				wiredRef.current = true;
			}

			await obs.connect(url, password);
			setIsConnected(true);
			setIsConnecting(false);
			return true;
		} catch (err) {
			setIsConnecting(false);
			setIsConnected(false);
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
			return false;
		}
	};

	const disconnect = async () => {
		const obs = obsRef.current;
		if (!obs) return;
		try {
			await obs.disconnect();
		} catch {
			// ignore
		} finally {
			setIsConnected(false);
		}
	};

	const broadcast = async (payload: ObsBroadcastPayload) => {
		const obs = obsRef.current;
		if (!obs || !isConnected) return;

		try {
			await obs.call("BroadcastCustomEvent", {
				eventData: { values: payload.values, thresholds: payload.thresholds } as JsonObject,
			});
		} catch (err) {
			console.error("OBS broadcast failed", err);
		}
	};

	const addCustomEventListener = (handler: CustomEventHandler) => {
		const obs = getObs();

		const wrappedHandler = (e: unknown) => {
			try {
				const maybe = e as { eventData?: unknown } | null;
				const raw =
					maybe && typeof maybe === "object" && "eventData" in maybe ? (maybe as { eventData: unknown }).eventData : e;
				handler(raw as ObsBroadcastPayload);
			} catch {
				// ignore handler errors
			}
		};

		obs.on("CustomEvent", wrappedHandler as (arg0: { eventData: object }) => void);

		return () => {
			obs.off("CustomEvent", wrappedHandler as (arg0: { eventData: object }) => void);
		};
	};

	useEffect(() => {
		return () => {
			if (obsRef.current) {
				try {
					obsRef.current.disconnect();
				} catch {
					// ignore on unmount
				}
				obsRef.current = null;
			}
		};
	}, []);

	return {
		connect,
		disconnect,
		broadcast,
		addCustomEventListener,
		isConnected,
		isConnecting,
		error,
	};
};
