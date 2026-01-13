import { type IDBPDatabase, openDB } from "idb";
import { joinRoom, type Room } from "trystero/torrent";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { DesktopMessage, MobileMessage } from "~/store/remoteStore";

const APP_ID = "webfsr-remote";
const DB_NAME = "webfsr";
const DB_VERSION = 1;
const SETTINGS_STORE = "settings";
const LAST_CODE_KEY = "lastCode";

const RTC_CONFIG: RTCConfiguration = {
	iceServers: [
		{ urls: "stun:stun.l.google.com:19302" },
		{ urls: "stun:stun1.l.google.com:19302" },
		{ urls: "stun:stun2.l.google.com:19302" },
		{ urls: "stun:stun.cloudflare.com:3478" },
	],
};

export interface UseRemoteControlOptions {
	role: "host" | "remote";
	code?: string;
	onPeerConnected?: () => void;
	onPeerDisconnected?: () => void;
	onMessage?: (message: DesktopMessage | MobileMessage) => void;
}

export interface UseRemoteControlReturn {
	isConnected: boolean;
	isConnecting: boolean;
	connectionError: string | null;
	code: string | null;
	peerId: string | null;
	connect: (targetCode?: string) => void;
	disconnect: () => void;
	send: (message: DesktopMessage | MobileMessage) => void;
	reconnectAttempt: number;
}

export const useRemoteControl = ({
	role,
	code: initialCode,
	onPeerConnected,
	onPeerDisconnected,
	onMessage,
}: UseRemoteControlOptions): UseRemoteControlReturn => {
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [code, setCode] = useState<string | null>(initialCode ?? null);
	const [peerId, setPeerId] = useState<string | null>(null);
	const [reconnectAttempt, setReconnectAttempt] = useState(0);

	// Refs to track state across effects and prevent issues with React Strict Mode for dev
	const roomRef = useRef<Room | null>(null);
	const sendMessageRef = useRef<((msg: DesktopMessage | MobileMessage, target?: string) => void) | null>(null);
	const connectedPeerRef = useRef<string | null>(null);
	const isCleaningUpRef = useRef(false);
	const targetCodeRef = useRef<string | null>(null);

	// Store callbacks in refs so they're always current
	const onPeerConnectedRef = useRef(onPeerConnected);
	const onPeerDisconnectedRef = useRef(onPeerDisconnected);
	const onMessageRef = useRef(onMessage);

	useEffect(() => {
		onPeerConnectedRef.current = onPeerConnected;
	}, [onPeerConnected]);

	useEffect(() => {
		onPeerDisconnectedRef.current = onPeerDisconnected;
	}, [onPeerDisconnected]);

	useEffect(() => {
		onMessageRef.current = onMessage;
	}, [onMessage]);

	const cleanup = () => {
		isCleaningUpRef.current = true;

		if (roomRef.current) {
			try {
				roomRef.current.leave();
			} catch {
				// Ignore errors during cleanup
			}
			roomRef.current = null;
		}

		sendMessageRef.current = null;
		connectedPeerRef.current = null;
		setIsConnected(false);
		setIsConnecting(false);
		setPeerId(null);

		// Reset cleanup flag after a tick
		setTimeout(() => {
			isCleaningUpRef.current = false;
		}, 0);
	};

	const connectInternal = (targetCode: string) => {
		// Prevent multiple connections
		if (roomRef.current || isCleaningUpRef.current) return;

		setIsConnecting(true);
		setConnectionError(null);
		targetCodeRef.current = targetCode;

		try {
			// Format code with prefix for room name
			const fullCode = targetCode.startsWith("webfsr-") ? targetCode : `webfsr-${targetCode}`;

			const room = joinRoom({ appId: APP_ID, rtcConfig: RTC_CONFIG }, fullCode);
			roomRef.current = room;

			// Helper to establish connection with a peer
			const establishPeerConnection = (peerId: string) => {
				// For host: only allow one peer connection
				if (role === "host" && connectedPeerRef.current) return;

				// Prevent duplicate connections
				if (connectedPeerRef.current === peerId) return;

				connectedPeerRef.current = peerId;
				setPeerId(peerId);
				setIsConnected(true);
				setIsConnecting(false);
				setReconnectAttempt(0);
				setConnectionError(null);

				if (onPeerConnectedRef.current) onPeerConnectedRef.current();
			};

			// Main message channel
			const [sendMessage, onMessageReceived] = room.makeAction<DesktopMessage | MobileMessage>("message");
			sendMessageRef.current = sendMessage;

			// Handshake action for peer discovery
			const [sendHandshake, onHandshake] = room.makeAction<{ type: "syn" | "ack" }>("handshake");

			// Handle handshake messages to establish a possible connection
			onHandshake((msg, peerId) => {
				if (msg.type === "syn") {
					// Peer announced themselves - establish connection and acknowledge
					establishPeerConnection(peerId);
					sendHandshake({ type: "ack" }, peerId);
				} else if (msg.type === "ack") {
					// Peer acknowledged our syn - establish connection
					establishPeerConnection(peerId);
				}
			});

			// Handle incoming app messages
			onMessageReceived((msg, _peerId) => {
				if (onMessageRef.current) onMessageRef.current(msg);
			});

			// Handle peer joining (fires for new peers joining after us)
			room.onPeerJoin((peerId) => {
				establishPeerConnection(peerId);
				// Send syn to the new peer in case they joined before our onPeerJoin registered
				sendHandshake({ type: "syn" }, peerId);
			});

			// Handle peer leaving
			room.onPeerLeave((peerId) => {
				if (connectedPeerRef.current === peerId) {
					connectedPeerRef.current = null;
					setPeerId(null);
					setIsConnected(false);

					if (onPeerDisconnectedRef.current) onPeerDisconnectedRef.current();
				}
			});

			// Broadcast syn to any peers already in the room
			// This handles the case where we joined after someone else
			sendHandshake({ type: "syn" });

			// For host, update code once connected
			if (role === "host") setCode(fullCode);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setConnectionError(message);
			setIsConnecting(false);
		}
	};

	const connect = (targetCode?: string) => {
		cleanup();

		// Short delay to allow cleanup to complete (mainly for strict mode)
		setTimeout(() => {
			if (role === "host") {
				const codeToUse = targetCode ?? `webfsr-${uuidv4()}`;
				setCode(codeToUse);
				connectInternal(codeToUse);
			} else {
				// Remote connects to provided code
				const codeToJoin = targetCode ?? initialCode;

				if (!codeToJoin) {
					setConnectionError("No code provided");
					return;
				}

				setCode(codeToJoin);
				connectInternal(codeToJoin);
			}
		}, 10);
	};

	const disconnect = () => {
		setReconnectAttempt(0);
		cleanup();

		setCode(null);
	};

	const send = (message: DesktopMessage | MobileMessage) => {
		if (!sendMessageRef.current || !connectedPeerRef.current) return;

		try {
			sendMessageRef.current(message, connectedPeerRef.current);
		} catch (err) {
			console.error("Failed to send message:", err);
		}
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (roomRef.current) {
				try {
					roomRef.current.leave();
				} catch {
					// Ignore
				}
				roomRef.current = null;
			}
		};
	}, []);

	return {
		isConnected,
		isConnecting,
		connectionError,
		code,
		peerId,
		connect,
		disconnect,
		send,
		reconnectAttempt,
	};
};

export function useLastCode() {
	const [lastCode, setLastCodeState] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [db, setDb] = useState<IDBPDatabase | null>(null);

	useEffect(() => {
		const init = async () => {
			try {
				const database = await openDB(DB_NAME, DB_VERSION);
				setDb(database);

				const setting = await database.getFromIndex(SETTINGS_STORE, "key", LAST_CODE_KEY);
				const savedCode = (setting?.value as string) || null;
				setLastCodeState(savedCode);
			} catch (error) {
				console.error("Failed to load lastCode from IndexedDB:", error);
			} finally {
				setIsLoading(false);
			}
		};

		init();
	}, []);

	const setLastCode = async (newCode: string | null) => {
		setLastCodeState(newCode);

		if (!db) {
			console.warn("IndexedDB not initialized, lastCode will not persist");
			return;
		}

		try {
			const existingSetting = await db.getFromIndex(SETTINGS_STORE, "key", LAST_CODE_KEY);

			if (newCode === null) {
				if (existingSetting) {
					await db.delete(SETTINGS_STORE, existingSetting.id);
				}
			} else if (existingSetting) {
				await db.put(SETTINGS_STORE, { ...existingSetting, value: newCode });
			} else {
				await db.add(SETTINGS_STORE, { key: LAST_CODE_KEY, value: newCode });
			}
		} catch (error) {
			console.error("Failed to save lastCode to IndexedDB:", error);
		}
	};

	const clearLastCode = async () => {
		await setLastCode(null);
	};

	return {
		lastCode,
		setLastCode,
		clearLastCode,
		isLoading,
	};
}
