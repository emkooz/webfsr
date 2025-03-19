import { useState, useRef, useCallback, useEffect } from "react";

export interface SerialData {
	rawData: string;
	values: number[];
}

export const useSerialPort = () => {
	const [port, setPort] = useState<SerialPort | null>(null);
	const [connected, setConnected] = useState<boolean>(false);
	const [connectionError, setConnectionError] = useState<string>("");
	const [latestData, setLatestData] = useState<SerialData | null>(null);
	const [requestsPerSecond, setRequestsPerSecond] = useState<number>(0);

	const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
	const writerRef = useRef<WritableStreamDefaultWriter | null>(null);
	const isReadingRef = useRef<boolean>(false);
	const requestCountRef = useRef<number>(0);

	// Command for requesting sensor data
	const requestData = new Uint8Array([118, 10]);

	// Calculate requests per second every second
	useEffect(() => {
		if (!connected) return;

		const interval = setInterval(() => {
			setRequestsPerSecond(requestCountRef.current);
			requestCountRef.current = 0;
		}, 1000);

		return () => clearInterval(interval);
	}, [connected]);

	const connect = useCallback(async () => {
		if (!("serial" in navigator)) {
			setConnectionError("WebSerial is not supported in this browser");
			return;
		}

		if (connected) return;

		try {
			const selectedPort = await navigator.serial.requestPort();
			await selectedPort.open({ baudRate: 9600 });

			setPort(selectedPort);
			setConnected(true);
			setConnectionError("");
			requestCountRef.current = 0;

			startReading(selectedPort);
		} catch (error) {
			setConnectionError(error instanceof Error ? error.message : "Failed to connect to device");
		}
	}, [connected]);

	const disconnect = useCallback(async () => {
		if (!connected || !port) return;

		try {
			isReadingRef.current = false;

			if (readerRef.current) readerRef.current.releaseLock();
			if (writerRef.current) writerRef.current.releaseLock();

			await port.close();

			setPort(null);
			setConnected(false);
			setConnectionError("");
			setRequestsPerSecond(0);
		} catch (error) {
			setConnectionError(error instanceof Error ? error.message : "Failed to disconnect from device");
		}
	}, [connected, port]);

	// Function to send text directly to the serial port
	const sendText = useCallback(
		async (text: string) => {
			if (!connected || !writerRef.current) return;

			try {
				const encoder = new TextEncoder();
				const data = encoder.encode(text);

				await writerRef.current.write(data);
			} catch (error) {
				console.error("Error sending message:", error);
			}
		},
		[connected],
	);

	const startReading = async (serialPort: SerialPort) => {
		if (!serialPort.readable || !serialPort.writable) return;

		const decoder = new TextDecoder();
		let buffer = "";

		isReadingRef.current = true;

		const readLoop = async () => {
			try {
				while (serialPort.readable && isReadingRef.current) {
					readerRef.current = serialPort.readable.getReader();
					writerRef.current = serialPort.writable.getWriter();

					try {
						let shouldRequestData = true;

						while (isReadingRef.current) {
							if (shouldRequestData) {
								try {
									await writerRef.current.write(requestData);
									requestCountRef.current++;
									shouldRequestData = false;
								} catch (writeErr) {
									console.error("Write error:", writeErr);
									break;
								}
							}

							// Read data
							try {
								if (!readerRef.current) break;

								const { value, done } = await readerRef.current.read();

								if (done) break;

								if (value) {
									buffer += decoder.decode(value, { stream: true });

									if (buffer.endsWith("\n")) {
										// for now we ignore the returns of the new threshold value
										// later on we should update the thresholds based on the real value

										if (buffer.startsWith("v")) {
											const values = buffer
												.trim()
												.split("\n")[0] // Take only the part before newline if it exists (i.e. thresholds also returned with sensor values are discarded)
												.split(" ")
												.slice(1)
												.map((v) => Number.parseInt(v, 10));

											setLatestData({
												rawData: buffer.trim(),
												values,
											});
										}

										buffer = "";
										shouldRequestData = true;
									}
								}
							} catch (readErr) {
								if (isReadingRef.current) console.error("Read error:", readErr);
								break;
							}
						}
					} finally {
						if (readerRef.current) {
							readerRef.current.releaseLock();
							readerRef.current = null;
						}
					}
				}
			} catch (error) {
				if (isReadingRef.current)
					setConnectionError(error instanceof Error ? error.message : "Error reading from serial port");
			}
		};

		readLoop();
	};

	return {
		connect,
		disconnect,
		connected,
		connectionError,
		latestData,
		isSupported: "serial" in navigator,
		requestsPerSecond,
		sendText,
	};
};
