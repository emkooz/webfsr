import { Download, History, Keyboard, Loader2, QrCode, Share, Unplug, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import MobileSensorCard from "~/components/MobileSensorCard";
import QRScanner from "~/components/QRScanner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useLastCode, useRemoteControl } from "~/lib/useRemoteControl";
import { useRemoteStore, type DesktopMessage, type MobileMessage } from "~/store/remoteStore";

const MOCK_SENSOR_COUNT = 6;
const MOCK_SENSOR_VALUES = [280, 620, 445, 780, 390, 540];
const MOCK_THRESHOLDS = [480, 550, 420, 600, 510, 470];
const MOCK_SENSOR_LABELS = Array.from({ length: MOCK_SENSOR_COUNT }, (_, i) => `Sensor ${i + 1}`);

type ConnectionState = "disconnected" | "qr-scanner" | "code-input" | "connecting" | "connected";

interface MobileDashboardProps {
	sensorColors: string[];
	thresholdColor: string;
	useThresholdColor: boolean;
	useSingleColor: boolean;
	singleBarColor: string;
	theme: "light" | "dark";
	canInstallPWA?: boolean;
	showIOSInstall?: boolean;
	isInstalled?: boolean;
	onInstallPWA?: () => Promise<boolean>;
	profileName?: string;
}

// Parse code from URL query params
const getCodeFromUrl = (): string | null => {
	if (typeof window === "undefined") return null;

	const params = new URLSearchParams(window.location.search);
	const code = params.get("code");
	if (!code) return null;

	// Handle both full code and just the UUID
	if (code.startsWith("webfsr-")) return code;

	return `webfsr-${code}`;
};

const MobileDashboard = ({
	thresholdColor,
	useThresholdColor,
	useSingleColor,
	singleBarColor,
	sensorColors,
	theme,
	canInstallPWA,
	showIOSInstall,
	isInstalled,
	onInstallPWA,
	profileName,
}: MobileDashboardProps) => {
	const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
	const [pairingCode, setPairingCode] = useState("");
	const [initialCode] = useState(() => getCodeFromUrl());
	const showInstallOption = !isInstalled && (canInstallPWA || showIOSInstall);
	const { lastCode, setLastCode } = useLastCode();
	const [showConnectionHelp, setShowConnectionHelp] = useState(false);
	const connectionHelpTimeoutRef = useRef<number | null>(null);

	// Remote store for received data
	const {
		remoteSensorValues,
		remoteThresholds,
		remoteSensorLabels,
		remoteSensorColors,
		remoteThresholdColor,
		remoteUseThresholdColor,
		remoteUseSingleColor,
		remoteSingleBarColor,
		remoteIsLocked,
		remoteTheme,
		updateRemoteData,
		updateSensorValues,
		reset: resetRemoteStore,
	} = useRemoteStore();

	// Handle messages from desktop
	const handleMessage = (message: DesktopMessage | MobileMessage) => {
		if (message.type === "sync") {
			updateRemoteData(message.payload);
		} else if (message.type === "values") {
			updateSensorValues(message.payload.values);
		}
	};

	// Ref to hold disconnect function so we can call it in the callback
	const disconnectRef = useRef<(() => void) | null>(null);

	const {
		isConnected: remoteConnected,
		isConnecting: remoteConnecting,
		connectionError,
		code: currentCode,
		connect: connectRemote,
		disconnect: disconnectRemote,
		send: sendRemote,
	} = useRemoteControl({
		role: "remote",
		code: initialCode ?? undefined,
		onPeerConnected: () => {
			setConnectionState("connected");

			// Signal to desktop that we're ready for data
			sendRemote({ type: "ready" });
		},
		onPeerDisconnected: () => {
			disconnectRef.current?.();
			setConnectionState("disconnected");
			resetRemoteStore();
		},
		onMessage: handleMessage,
	});

	// Keep disconnect ref updated
	useEffect(() => {
		disconnectRef.current = disconnectRemote;
	}, [disconnectRemote]);

	// Save code when successfully connected
	useEffect(() => {
		if (remoteConnected && currentCode) void setLastCode(currentCode);
	}, [remoteConnected, currentCode]);

	// Auto-connect if code is in URL
	useEffect(() => {
		if (initialCode && connectionState === "disconnected") {
			setConnectionState("connecting");
			connectRemote(initialCode);
		}
	}, []);

	// Sync connection state with hook state
	useEffect(() => {
		if (remoteConnected && connectionState !== "connected") {
			setConnectionState("connected");
		} else if (!remoteConnected && connectionState === "connected") {
			if (remoteConnecting) {
				setConnectionState("connecting");
			} else {
				setConnectionState("disconnected");
			}
		}
	}, [remoteConnected, remoteConnecting, connectionState]);

	// Show connection help after 20 seconds of connecting
	useEffect(() => {
		if (connectionHelpTimeoutRef.current) {
			window.clearTimeout(connectionHelpTimeoutRef.current);
			connectionHelpTimeoutRef.current = null;
		}

		if (connectionState !== "connecting") {
			setShowConnectionHelp(false);
			return;
		}

		connectionHelpTimeoutRef.current = window.setTimeout(() => {
			setShowConnectionHelp(true);
		}, 20000);

		return () => {
			if (connectionHelpTimeoutRef.current) {
				window.clearTimeout(connectionHelpTimeoutRef.current);
			}
		};
	}, [connectionState]);

	const handleStartQrScanner = () => {
		setConnectionState("qr-scanner");
	};

	const handleStartCodeInput = () => {
		setConnectionState("code-input");
	};

	const handleConnectToLastDevice = () => {
		if (!lastCode) return;

		setConnectionState("connecting");
		connectRemote(lastCode);
	};

	const handleCancel = () => {
		disconnectRemote();
		setConnectionState("disconnected");
		setPairingCode("");
		resetRemoteStore();
	};

	const handleQRScan = (scannedCode: string) => {
		setConnectionState("connecting");
		connectRemote(scannedCode);
	};

	const handleSubmitCode = () => {
		if (!pairingCode.trim()) return;

		// Normalize the code (lowercase for UUID, remove any prefix)
		let code = pairingCode.trim().toLowerCase();
		if (code.startsWith("webfsr-")) {
			code = code.slice(7);
		}

		// Construct the full code
		const codeToJoin = `webfsr-${code}`;

		setConnectionState("connecting");
		connectRemote(codeToJoin);
		setPairingCode("");
	};

	const handleDisconnect = () => {
		disconnectRemote();
		setConnectionState("disconnected");
		resetRemoteStore();
	};

	// Handle threshold change from mobile
	const handleMobileThresholdChange = (index: number, value: number) => {
		// Send to desktop
		sendRemote({ type: "threshold", index, value });
	};

	const getColor = (index: number) => {
		if (remoteUseSingleColor) return remoteSingleBarColor;

		if (remoteSensorColors.length > 0) return remoteSensorColors[index % remoteSensorColors.length] || "#ff0000";

		if (useSingleColor) return singleBarColor;

		return sensorColors[index % sensorColors.length] || "#ff0000";
	};

	const effectiveTheme = remoteTheme || theme;
	const effectiveThresholdColor = remoteThresholdColor || thresholdColor;
	const effectiveUseThresholdColor = remoteUseThresholdColor ?? useThresholdColor;

	// Disconnected state with blurred mock data
	if (connectionState === "disconnected") {
		return (
			<div className="relative h-dvh w-screen overflow-hidden bg-background">
				{/* Blurred mock sensor cards */}
				<div className="absolute inset-0 p-4 overflow-auto blur-[2px] pointer-events-none select-none">
					<div className="grid gap-4 grid-cols-1 landscape:grid-cols-2">
						{Array.from({ length: MOCK_SENSOR_COUNT }, (_, i) => (
							<MobileSensorCard
								key={`mock-${i}`}
								label={MOCK_SENSOR_LABELS[i]}
								value={MOCK_SENSOR_VALUES[i]}
								threshold={MOCK_THRESHOLDS[i]}
								color={getColor(i)}
								thresholdColor={effectiveThresholdColor}
								useThresholdColor={effectiveUseThresholdColor}
								index={i}
								onThresholdChange={() => {}}
								isLocked={true}
								theme={effectiveTheme}
							/>
						))}
					</div>
				</div>

				{/* Overlay with connect button */}
				<div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
					<div className="mx-6 max-w-sm rounded-2xl border bg-background/95 p-6 shadow-2xl backdrop-blur-sm">
						<div className="flex items-center justify-center gap-3 mb-4">
							<Unplug className="size-6 text-muted-foreground" />
							<h2 className="text-lg font-semibold">Disconnected</h2>
						</div>
						<p className="text-sm text-muted-foreground text-center mb-6">Connect to a desktop running WebFSR to control your pad</p>
						<div className="flex flex-col gap-3">
							{/* Reconnect to last device option */}
							{lastCode && (
								<Button size="lg" className="w-full h-14 text-base gap-3" onClick={handleConnectToLastDevice}>
									<History className="size-5" />
									Connect to Last Device
								</Button>
							)}
							<Button
								size={lastCode ? "default" : "lg"}
								variant={lastCode ? "outline" : "default"}
								className={lastCode ? "w-full h-12 text-base gap-3" : "w-full h-14 text-base gap-3"}
								onClick={handleStartQrScanner}
							>
								<QrCode className="size-5" />
								Scan QR Code
							</Button>
							<Button variant="outline" size="default" className="w-full h-12 text-base gap-3" onClick={handleStartCodeInput}>
								<Keyboard className="size-5" />
								Enter Code Manually
							</Button>
							{/* Subtle install option */}
							{showInstallOption && (
								<Button
									variant="ghost"
									size="sm"
									className="w-full text-muted-foreground gap-2"
									onClick={() => (canInstallPWA && onInstallPWA ? onInstallPWA() : undefined)}
								>
									<Download className="size-4" />
									{canInstallPWA ? (
										"Install App (PWA)"
									) : showIOSInstall ? (
										<span className="flex items-center gap-1">Add to Home Screen (PWA)</span>
									) : null}
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	// QR Scanner state
	if (connectionState === "qr-scanner") {
		return (
			<QRScanner
				onScan={handleQRScan}
				onError={(error) => {
					console.error("QR scan error:", error);
				}}
				onClose={handleCancel}
				onSwitchToCodeInput={handleStartCodeInput}
			/>
		);
	}

	// Code input state
	if (connectionState === "code-input") {
		return (
			<div className="h-dvh w-screen flex flex-col bg-background">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b">
					<h2 className="text-lg font-semibold">Enter Pairing Code</h2>
					<Button variant="ghost" size="icon" onClick={handleCancel} aria-label="Cancel">
						<X className="size-6" />
					</Button>
				</div>

				{/* Code input form */}
				<div className="flex-1 flex flex-col items-center justify-center p-6">
					<div className="w-full max-w-md">
						<p className="text-sm text-muted-foreground text-center mb-6">
							Enter the pairing code shown on your desktop WebFSR instance
						</p>
						<Input
							type="text"
							inputMode="text"
							maxLength={36}
							placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
							value={pairingCode}
							onChange={(e) => setPairingCode(e.target.value.toLowerCase())}
							className="text-center text-sm h-14 font-mono"
							autoFocus
							autoComplete="off"
							spellCheck={false}
						/>

						<Button size="lg" className="w-full mt-4 h-14" disabled={pairingCode.length < 32} onClick={handleSubmitCode}>
							Connect
						</Button>
					</div>
				</div>

				{/* Footer */}
				<div className="p-4 border-t">
					<Button variant="ghost" className="w-full" onClick={handleStartQrScanner}>
						<QrCode className="size-4 mr-2" />
						Scan QR Code Instead
					</Button>
				</div>
			</div>
		);
	}

	// Connecting state
	if (connectionState === "connecting") {
		// Extract just the UUID from the code for display
		const displayCode = currentCode?.replace("webfsr-", "") ?? "";

		return (
			<div className="h-dvh w-screen flex items-center justify-center bg-background">
				<div className="text-center px-6 max-w-sm">
					<Loader2 className="size-12 text-primary animate-spin mx-auto mb-4" />
					<h2 className="text-lg font-semibold mb-2">Connecting…</h2>
					<p className="text-sm text-muted-foreground mb-4">Establishing connection to desktop</p>
					{displayCode && (
						<code className="block text-xs font-mono text-muted-foreground bg-muted px-3 py-2 rounded-lg mb-4 break-all">
							{displayCode}
						</code>
					)}
					{connectionError && <p className="text-sm text-destructive mb-4">{connectionError}</p>}
					{showConnectionHelp && (
						<div className="text-left p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg mb-4">
							<div className="text-xs text-blue-800 dark:text-blue-200">
								<p className="font-medium mb-1">Can't connect?</p>
								<p className="text-xs">
									Check your WebRTC and firewall settings. <br /> Restrictive networks may prevent direct connections.
								</p>
							</div>
						</div>
					)}
					<Button variant="outline" onClick={handleCancel} className="gap-2">
						<X className="size-4" />
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	// Connected state - sensor cards
	const numSensors = remoteThresholds.length || remoteSensorValues.length || 6;

	return (
		<div className="h-dvh w-screen overflow-auto bg-background">
			{/* Connection status header */}
			<div className="sticky top-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-green-500/10 border-b border-green-500/20 grid grid-cols-3 items-center">
				<div className="flex items-center gap-2">
					<div className="size-2 rounded-full bg-green-500 animate-pulse" />
					<span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
				</div>
				<div className="flex items-center justify-center gap-2">
					<span className="text-sm font-semibold">WebFSR</span>
					{profileName && <span className="text-sm text-muted-foreground">{profileName}</span>}
				</div>
				<div className="flex items-center justify-end gap-1">
					<Button variant="ghost" size="sm" onClick={handleDisconnect} className="h-8 gap-1.5 text-muted-foreground">
						<Unplug className="size-3.5" />
						Disconnect
					</Button>
				</div>
			</div>

			<div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
				<div className="grid gap-4 grid-cols-1 landscape:grid-cols-2">
					{Array.from({ length: numSensors }, (_, i) => (
						<MobileSensorCard
							key={`sensor-${i}`}
							label={remoteSensorLabels[i] || `Sensor ${i + 1}`}
							value={remoteSensorValues[i] ?? 0}
							threshold={remoteThresholds[i] ?? 512}
							color={getColor(i)}
							thresholdColor={effectiveThresholdColor}
							useThresholdColor={effectiveUseThresholdColor}
							index={i}
							onThresholdChange={handleMobileThresholdChange}
							isLocked={remoteIsLocked}
							theme={effectiveTheme}
						/>
					))}
				</div>
			</div>
		</div>
	);
};

export default MobileDashboard;
