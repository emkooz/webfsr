import { useState, useEffect, useRef } from "react";

// Standard GATT Heartrate Service UUIDs
const HEARTRATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb"; // Heartrate Service
const HEARTRATE_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb"; // Heartrate Measurement Characteristic
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 600; // ms

// Shows up in reconnect attempts and should be ignored until final connection attempt
const GATT_DISCONNECTED_ERROR = "GATT Server is disconnected. Cannot retrieve services";

export interface HeartrateData {
	heartrate: number;
	timestamp: number;
}

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

	// Check if WebBluetooth is supported
	const isSupported = typeof navigator !== "undefined" && "bluetooth" in navigator;

	// Synchronize the connection state ref with state
	useEffect(() => {
		isConnectedRef.current = isConnected;
	}, [isConnected]);

	// Function to parse heartrate data from the characteristic value
	const parseHeartrate = (value: DataView): number => {
		// Defined in GATT spec
		// The first byte contains flags
		// If the LSB of the flags is 0, the heartrate is in the 2nd byte (uint8)
		// If the LSB of the flags is 1, the heartrate is in the 2nd and 3rd bytes (uint16)
		const flags = value.getUint8(0);
		const rate16Bits = flags & 0x1;

		let heartrate: number;
		if (rate16Bits) {
			heartrate = value.getUint16(1, true);
		} else {
			heartrate = value.getUint8(1);
		}

		return heartrate;
	};

	// Handler for receiving heartrate data
	const handleHeartrateNotification = (event: Event) => {
		const chrValue = event.target as unknown as BluetoothRemoteGATTCharacteristic;
		const value = chrValue.value;

		// If we're receiving data, we're definitely connected
		if (!isConnectedRef.current) setIsConnected(true);

		if (value) {
			const heartrate = parseHeartrate(value);
			setHeartrateData({
				heartrate,
				timestamp: Date.now(),
			});
		}
	};

	// Check if an error is a common reconnection error that should be suppressed
	const isCommonReconnectError = (err: unknown): boolean => {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return errorMessage.includes(GATT_DISCONNECTED_ERROR);
	};

	// Establish GATT connection
	const setupGattConnection = async (connectedDevice: BluetoothDevice): Promise<boolean> => {
		let attemptCounter = 0;
		let currentServer: BluetoothRemoteGATTServer | null = null;

		// Reset states at beginning of connection attempt
		setIsConnected(false);
		isConnectedRef.current = false;
		setReconnectAttempts(0);
		setError(null);

		while (attemptCounter <= MAX_RECONNECT_ATTEMPTS) {
			try {
				setReconnectAttempts(attemptCounter);

				// Mark as reconnecting if this isn't the first attempt
				setIsReconnecting(attemptCounter > 0);

				// Connect to GATT server
				const newServer = await connectedDevice.gatt?.connect();
				if (!newServer) throw new Error("Failed to connect to GATT server");

				currentServer = newServer;
				setServer(newServer);

				// Wait briefly to ensure connection is stable
				const delayTime = attemptCounter === 0 ? 600 : 300;
				await new Promise((resolve) => setTimeout(resolve, delayTime));

				if (!newServer.connected) throw new Error("GATT Server disconnected immediately after connection");

				// Get heartrate service and characteristic
				const service = await newServer.getPrimaryService(HEARTRATE_SERVICE);
				const newCharacteristic = await service.getCharacteristic(HEARTRATE_CHARACTERISTIC);

				setCharacteristic(newCharacteristic);

				// Start notifications
				await newCharacteristic.startNotifications();
				newCharacteristic.addEventListener("characteristicvaluechanged", handleHeartrateNotification);

				// Reset connection states and mark as connected
				setReconnectAttempts(0);
				setIsReconnecting(false);
				setIsConnecting(false);
				setError(null);
				setIsConnected(true);
				isConnectedRef.current = true;

				return true;
			} catch (err) {
				// Clean up server connection if it exists
				if (currentServer?.connected) {
					try {
						currentServer.disconnect();
					} catch {
						// Ignore disconnection errors
					}
				}

				// Only increment attempt counter if we haven't reached the max attempts
				if (attemptCounter < MAX_RECONNECT_ATTEMPTS) {
					// Wait before trying again with increasing delay
					const dynamicDelay = RECONNECT_DELAY * (1 + 0.5 * attemptCounter);
					await new Promise((resolve) => setTimeout(resolve, dynamicDelay));
					attemptCounter++;
					continue;
				}

				// Report error and reset states since all attempts failed
				setReconnectAttempts(0);
				setIsReconnecting(false);
				setIsConnecting(false);
				setIsConnected(false);
				isConnectedRef.current = false;

				// Only set error if it's not a common error
				if (!isCommonReconnectError(err)) {
					setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
				} else {
					setError("Failed to establish a stable connection with the heartrate monitor");
				}
				return false;
			}
		}

		return false;
	};

	// Connect to a heartrate monitor
	const connect = async () => {
		if (!isSupported) {
			setError("WebBluetooth is not supported in this browser");
			return false;
		}

		try {
			// Reset all states at the beginning of connection
			setIsConnecting(true);
			setError(null);
			setReconnectAttempts(0);
			setIsReconnecting(false);
			setIsConnected(false);
			isConnectedRef.current = false;

			// Create filters for the Bluetooth device request
			const filters: Array<{
				services?: string[];
				name?: string;
				namePrefix?: string;
			}> = [{ services: [HEARTRATE_SERVICE] }];

			// Request device with heartrate service
			const device = await navigator.bluetooth.requestDevice({ filters });

			// Set up disconnect listener
			const handleDisconnect = () => {
				// Only handle disconnect events if we're not in the process of connecting/reconnecting
				if (!isConnecting && !isReconnecting) {
					setServer(null);
					setCharacteristic(null);
					setHeartrateData(null);
					setIsConnected(false);
					isConnectedRef.current = false;
				}
			};

			device.addEventListener("gattserverdisconnected", handleDisconnect);
			setDevice(device);

			// Set up GATT connection, services, and characteristics
			const success = await setupGattConnection(device);
			setIsConnecting(false);

			if (success) return true;

			// If connection failed completely after all retries, clean up
			device.removeEventListener("gattserverdisconnected", handleDisconnect);
			setDevice(null);
			setServer(null);
			return false;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			setError(errorMessage);
			setIsConnecting(false);
			setIsReconnecting(false);
			setIsConnected(false);
			isConnectedRef.current = false;
			return false;
		}
	};

	// Disconnect from heartrate monitor
	const disconnect = async () => {
		// Clean up characteristic
		if (characteristic) {
			try {
				characteristic.removeEventListener("characteristicvaluechanged", handleHeartrateNotification);
				await characteristic.stopNotifications();
			} catch {
				// Ignore errors on disconnect
			}

			setCharacteristic(null);
		}

		// Clean up server
		if (server) {
			try {
				if (server.connected) server.disconnect();
			} catch {
				// Ignore errors on disconnect
			}

			setServer(null);
		}

		// Clean up device
		if (device) setDevice(null);

		// Reset all states
		setHeartrateData(null);
		setError(null);
		setReconnectAttempts(0);
		setIsReconnecting(false);
		setIsConnecting(false);
		setIsConnected(false);
		isConnectedRef.current = false;
	};

	// Clean up when component unmounts
	useEffect(() => {
		return () => {
			if (device?.gatt?.connected) disconnect();
		};
	}, [device, disconnect]);

	// Ensure heartrate data implies connected state
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
