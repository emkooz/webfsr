import { useState, useEffect, useRef, useCallback } from "react";

// Standard GATT Heartrate Service UUIDs
const HEARTRATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb"; // Heartrate Service
const HEARTRATE_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb"; // Heartrate Measurement Characteristic
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 600; // ms
const BLUETOOTH_OPERATION_TIMEOUT = 10000; // ms

// Shows up in reconnect attempts and should be ignored until final connection attempt
const GATT_DISCONNECTED_ERROR = "GATT Server is disconnected. Cannot retrieve services";

export interface HeartrateData {
	heartrate: number;
	timestamp: number;
}

type DisconnectListener = {
	device: BluetoothDevice;
	handler: EventListener;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useHeartrateMonitor = () => {
	const [device, setDevice] = useState<BluetoothDevice | null>(null);
	const [heartrateData, setHeartrateData] = useState<HeartrateData | null>(null);
	const [isConnecting, setIsConnecting] = useState<boolean>(false);
	const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [server, setServer] = useState<BluetoothRemoteGATTServer | null>(null);
	const [characteristic, setCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
	const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
	const [isConnected, setIsConnected] = useState<boolean>(false);
	const isConnectedRef = useRef<boolean>(false);
	const isConnectingRef = useRef<boolean>(false);
	const isReconnectingRef = useRef<boolean>(false);
	const deviceRef = useRef<BluetoothDevice | null>(null);
	const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);
	const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
	const disconnectListenerRef = useRef<DisconnectListener | null>(null);
	const hasReceivedSampleRef = useRef<boolean>(false);

	// Check if WebBluetooth is supported
	const isSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;

	useEffect(() => {
		isConnectedRef.current = isConnected;
	}, [isConnected]);

	useEffect(() => {
		isConnectingRef.current = isConnecting;
	}, [isConnecting]);

	useEffect(() => {
		isReconnectingRef.current = isReconnecting;
	}, [isReconnecting]);

	useEffect(() => {
		deviceRef.current = device;
	}, [device]);

	useEffect(() => {
		serverRef.current = server;
	}, [server]);

	useEffect(() => {
		characteristicRef.current = characteristic;
	}, [characteristic]);

	const updateConnectingState = useCallback((connecting: boolean, reconnecting: boolean) => {
		isConnectingRef.current = connecting;
		isReconnectingRef.current = reconnecting;
		setIsConnecting(connecting);
		setIsReconnecting(reconnecting);
	}, []);

	const resetConnectionState = useCallback(
		(options?: { clearDevice?: boolean; clearError?: boolean; clearHeartrateData?: boolean }) => {
			const { clearDevice = false, clearError = false, clearHeartrateData = false } = options ?? {};

			if (clearDevice) {
				deviceRef.current = null;
				setDevice(null);
			}

			serverRef.current = null;
			characteristicRef.current = null;
			setServer(null);
			setCharacteristic(null);

			if (clearHeartrateData) setHeartrateData(null);
			if (clearError) setError(null);

			setReconnectAttempts(0);
			updateConnectingState(false, false);
			setIsConnected(false);
			isConnectedRef.current = false;
			hasReceivedSampleRef.current = false;
		},
		[updateConnectingState],
	);

	const removeDisconnectListener = useCallback((targetDevice?: BluetoothDevice | null) => {
		const registeredListener = disconnectListenerRef.current;
		if (!registeredListener) return;
		if (targetDevice && registeredListener.device !== targetDevice) return;

		registeredListener.device.removeEventListener("gattserverdisconnected", registeredListener.handler);
		disconnectListenerRef.current = null;
	}, []);

	const parseHeartrate = (value: DataView): number => {
		// Defined in GATT spec
		// The first byte contains flags
		// If the LSB of the flags is 0, the heartrate is in the 2nd byte (uint8)
		// If the LSB of the flags is 1, the heartrate is in the 2nd and 3rd bytes (uint16)
		const flags = value.getUint8(0);
		const rate16Bits = flags & 0x1;

		if (rate16Bits) {
			return value.getUint16(1, true);
		}

		return value.getUint8(1);
	};

	const handleHeartrateNotification = useCallback((event: Event) => {
		const chrValue = event.target as unknown as BluetoothRemoteGATTCharacteristic;
		const value = chrValue.value;

		if (!value) return;

		const heartrate = parseHeartrate(value);
		if (!isConnectedRef.current) {
			setIsConnected(true);
			isConnectedRef.current = true;
		}

		if (!hasReceivedSampleRef.current) hasReceivedSampleRef.current = true;

		setHeartrateData({
			heartrate,
			timestamp: Date.now(),
		});
	}, []);

	const isCommonReconnectError = (err: unknown): boolean => {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return errorMessage.includes(GATT_DISCONNECTED_ERROR);
	};

	const withTimeout = useCallback(
		async <T>(promise: Promise<T> | undefined, label: string, timeoutMs = BLUETOOTH_OPERATION_TIMEOUT): Promise<T> => {
			if (!promise) throw new Error(`${label} could not start`);

			let timeoutId: ReturnType<typeof setTimeout> | undefined;

			try {
				return await Promise.race([
					promise,
					new Promise<never>((_, reject) => {
						timeoutId = setTimeout(() => {
							reject(new Error(`${label} timed out after ${timeoutMs}ms`));
						}, timeoutMs);
					}),
				]);
			} finally {
				if (timeoutId) clearTimeout(timeoutId);
			}
		},
		[],
	);

	const teardownCharacteristic = useCallback(async () => {
		const currentCharacteristic = characteristicRef.current;
		if (!currentCharacteristic) return;

		try {
			currentCharacteristic.removeEventListener("characteristicvaluechanged", handleHeartrateNotification);
			await currentCharacteristic.stopNotifications();
		} catch {
			// Ignore teardown errors during reconnect/disconnect.
		}

		characteristicRef.current = null;
		setCharacteristic(null);
	}, [handleHeartrateNotification]);

	const setupGattConnection = useCallback(
		async (connectedDevice: BluetoothDevice): Promise<boolean> => {
			let attemptCounter = 0;
			let currentServer: BluetoothRemoteGATTServer | null = null;

			setIsConnected(false);
			isConnectedRef.current = false;
			setReconnectAttempts(0);
			setError(null);
			hasReceivedSampleRef.current = false;

			while (attemptCounter <= MAX_RECONNECT_ATTEMPTS) {
				try {
					setReconnectAttempts(attemptCounter);
					updateConnectingState(true, attemptCounter > 0);

					const newServer = await withTimeout<BluetoothRemoteGATTServer>(connectedDevice.gatt?.connect(), "GATT connect");
					currentServer = newServer;
					serverRef.current = newServer;
					setServer(newServer);

					await sleep(attemptCounter === 0 ? 600 : 300);

					if (!newServer.connected) {
						throw new Error("GATT server disconnected immediately after connect");
					}

					const service = await withTimeout<BluetoothRemoteGATTService>(
						newServer.getPrimaryService(HEARTRATE_SERVICE),
						"Heart Rate service lookup",
					);

					const newCharacteristic = await withTimeout<BluetoothRemoteGATTCharacteristic>(
						service.getCharacteristic(HEARTRATE_CHARACTERISTIC),
						"Heart Rate measurement characteristic lookup",
					);

					characteristicRef.current = newCharacteristic;
					setCharacteristic(newCharacteristic);

					await withTimeout<BluetoothRemoteGATTCharacteristic>(
						newCharacteristic.startNotifications(),
						"Heart Rate notifications start",
					);
					newCharacteristic.addEventListener("characteristicvaluechanged", handleHeartrateNotification);

					setReconnectAttempts(0);
					updateConnectingState(false, false);
					setError(null);
					setIsConnected(true);
					isConnectedRef.current = true;

					return true;
				} catch (err) {
					const errorMessage = err instanceof Error ? err.message : String(err);

					await teardownCharacteristic();

					if (currentServer?.connected) {
						try {
							currentServer.disconnect();
						} catch {
							// Ignore disconnection errors
						}
					}

					serverRef.current = null;
					setServer(null);

					if (attemptCounter < MAX_RECONNECT_ATTEMPTS) {
						const dynamicDelay = RECONNECT_DELAY * (1 + 0.5 * attemptCounter);
						await sleep(dynamicDelay);
						attemptCounter++;
						continue;
					}

					setReconnectAttempts(0);
					updateConnectingState(false, false);
					setIsConnected(false);
					isConnectedRef.current = false;

					if (!isCommonReconnectError(err)) {
						setError(`Failed to connect: ${errorMessage}`);
					} else {
						setError("Failed to establish a stable connection with the heartrate monitor");
					}

					return false;
				}
			}

			return false;
		},
		[handleHeartrateNotification, teardownCharacteristic, updateConnectingState, withTimeout],
	);

	const disconnect = useCallback(async () => {
		const currentDevice = deviceRef.current;
		removeDisconnectListener(currentDevice);
		await teardownCharacteristic();

		const currentServer = serverRef.current;
		if (currentServer) {
			try {
				if (currentServer.connected) currentServer.disconnect();
			} catch {
				// Ignore errors on disconnect
			}
		}

		resetConnectionState({ clearDevice: true, clearError: true, clearHeartrateData: true });
	}, [removeDisconnectListener, resetConnectionState, teardownCharacteristic]);

	const connect = useCallback(async () => {
		if (!isSupported) {
			setError("WebBluetooth is not supported in this browser");
			return false;
		}

		try {
			resetConnectionState({ clearError: true, clearHeartrateData: true });
			updateConnectingState(true, false);

			const filters: Array<{
				services?: string[];
				name?: string;
				namePrefix?: string;
			}> = [{ services: [HEARTRATE_SERVICE] }];

			const nextDevice = await navigator.bluetooth.requestDevice({ filters });

			const handleDisconnect = () => {
				const disconnectedDuringSetup = isConnectingRef.current || isReconnectingRef.current;
				resetConnectionState({ clearHeartrateData: !disconnectedDuringSetup });
			};

			removeDisconnectListener();
			nextDevice.addEventListener("gattserverdisconnected", handleDisconnect);
			disconnectListenerRef.current = { device: nextDevice, handler: handleDisconnect };
			deviceRef.current = nextDevice;
			setDevice(nextDevice);

			const success = await setupGattConnection(nextDevice);
			updateConnectingState(false, false);

			if (success) return true;

			removeDisconnectListener(nextDevice);
			resetConnectionState({ clearDevice: true });
			return false;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			setError(errorMessage);
			updateConnectingState(false, false);
			setIsConnected(false);
			isConnectedRef.current = false;
			return false;
		}
	}, [isSupported, removeDisconnectListener, resetConnectionState, setupGattConnection, updateConnectingState]);

	useEffect(() => {
		return () => {
			removeDisconnectListener();
			const currentCharacteristic = characteristicRef.current;
			if (currentCharacteristic) {
				currentCharacteristic.removeEventListener("characteristicvaluechanged", handleHeartrateNotification);
			}
			if (currentCharacteristic && "stopNotifications" in currentCharacteristic) {
				void currentCharacteristic.stopNotifications().catch(() => undefined);
			}
			if (serverRef.current?.connected) {
				try {
					serverRef.current.disconnect();
				} catch {
					// Ignore cleanup errors on unmount.
				}
			}
		};
	}, [handleHeartrateNotification, removeDisconnectListener]);

	useEffect(() => {
		if (heartrateData && !isConnected) {
			setIsConnected(true);
			isConnectedRef.current = true;
		}
	}, [heartrateData, isConnected]);

	return {
		connect,
		disconnect,
		heartrateData,
		device,
		isConnecting: isConnecting || isReconnecting,
		isConnected,
		error,
		isSupported,
		reconnectAttempt: reconnectAttempts,
		maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
		isReconnecting,
	};
};
