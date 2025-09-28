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

	// Auto-reconnect state
	const [autoConnect, setAutoConnect] = useState<boolean>(false);
	const autoConnectRef = useRef<boolean>(false);
	const [nextRetryInMs, setNextRetryInMs] = useState<number>(0);
	const backoffAttemptRef = useRef<number>(0);
	const reconnectTimerRef = useRef<number | null>(null);
	const countdownTimerRef = useRef<number | null>(null);
	const lastPasswordRef = useRef<string>("");
	const lastUrlRef = useRef<string>("ws://127.0.0.1:4455");

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
			lastPasswordRef.current = password;
			lastUrlRef.current = url;

			if (!wiredRef.current) {
				obs.on("ConnectionClosed", () => {
					setIsConnected(false);
					if (autoConnectRef.current && lastPasswordRef.current) scheduleReconnect();
				});

				obs.on("Identified", () => {
					setIsConnected(true);
					backoffAttemptRef.current = 0;
					clearReconnectTimers();
					setNextRetryInMs(0);
				});

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
			if (autoConnectRef.current && lastPasswordRef.current) scheduleReconnect();
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
			clearReconnectTimers();
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

	const clearReconnectTimers = () => {
		if (reconnectTimerRef.current) {
			window.clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}

		if (countdownTimerRef.current) {
			window.clearInterval(countdownTimerRef.current);
			countdownTimerRef.current = null;
		}
	};

	const scheduleReconnect = () => {
		clearReconnectTimers();

		// Exponential backoff capped at ~15s
		const base = 1000;
		const attempt = backoffAttemptRef.current;
		const delay = Math.min(15000, base * 2 ** attempt);
		setNextRetryInMs(delay);

		const start = Date.now();
		countdownTimerRef.current = window.setInterval(() => {
			const elapsed = Date.now() - start;
			const remaining = Math.max(0, delay - elapsed);
			setNextRetryInMs(remaining);
			if (remaining <= 0 && countdownTimerRef.current) {
				window.clearInterval(countdownTimerRef.current);
				countdownTimerRef.current = null;
			}
		}, 1000);

		reconnectTimerRef.current = window.setTimeout(() => {
			if (!autoConnectRef.current || !lastPasswordRef.current) return;
			backoffAttemptRef.current = Math.min(10, backoffAttemptRef.current + 1);
			void connect(lastPasswordRef.current, lastUrlRef.current);
		}, delay);
	};

	const setAutoConnectEnabled = (enabled: boolean, password?: string, url?: string) => {
		setAutoConnect(enabled);
		autoConnectRef.current = enabled;

		if (password) lastPasswordRef.current = password;
		if (url) lastUrlRef.current = url;

		if (!enabled) {
			clearReconnectTimers();
			return;
		}

		if (!isConnected && !isConnecting && lastPasswordRef.current) {
			backoffAttemptRef.current = 0;
			clearReconnectTimers();
			void connect(lastPasswordRef.current, lastUrlRef.current);
		}
	};

	useEffect(() => {
		autoConnectRef.current = autoConnect;
	}, [autoConnect]);

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

			clearReconnectTimers();
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
		autoConnect,
		nextRetryInMs,
		setAutoConnectEnabled,
	};
};
