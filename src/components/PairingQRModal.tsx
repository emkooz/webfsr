import { AlertTriangle, CheckCircle2, Copy, History, Loader2, Plus, Smartphone, Unplug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";

// CSS for the connection success animation
const connectionAnimationStyles = `
@keyframes qr-to-check-container-light {
	0% { background-color: rgb(255, 255, 255); border-color: rgb(229, 231, 235); }
	100% { background-color: rgb(240, 253, 244); border-color: rgb(187, 247, 208); }
}
@keyframes qr-to-check-container-dark {
	0% { 
		background-color: rgb(255, 255, 255); 
		border-color: rgb(229, 231, 235);
		box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
	}
	30% { 
		background-color: rgb(200, 230, 210); 
		border-color: rgba(34, 197, 94, 0.4);
		box-shadow: 0 0 30px 5px rgba(34, 197, 94, 0.3);
	}
	60% { 
		background-color: rgb(80, 140, 100); 
		border-color: rgba(34, 197, 94, 0.4);
		box-shadow: 0 0 40px 10px rgba(34, 197, 94, 0.25);
	}
	100% { 
		background-color: rgba(34, 197, 94, 0.1); 
		border-color: rgba(34, 197, 94, 0.3);
		box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
	}
}
@keyframes qr-fade-out {
	0% { opacity: 1; transform: scale(1); }
	100% { opacity: 0; transform: scale(0.8); }
}
@keyframes check-scale-in {
	0% { transform: scale(0) rotate(-45deg); opacity: 0; }
	50% { transform: scale(1.15) rotate(5deg); opacity: 1; }
	70% { transform: scale(0.95) rotate(-2deg); }
	100% { transform: scale(1) rotate(0deg); }
}
@keyframes check-scale-in-dark {
	0% { transform: scale(0) rotate(-45deg); opacity: 0; filter: brightness(1.5); }
	50% { transform: scale(1.15) rotate(5deg); opacity: 1; filter: brightness(1.2); }
	70% { transform: scale(0.95) rotate(-2deg); filter: brightness(1.1); }
	100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
}
@keyframes success-text-fade {
	0% { opacity: 0; transform: translateY(8px); }
	100% { opacity: 1; transform: translateY(0); }
}
`;

interface PairingQRModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	code: string | null;
	isConnected: boolean;
	isConnecting: boolean;
	onDisconnect: () => void;
	lastCode: string | null;
	onUseLastCode: () => void;
	onUseNewCode: () => void;
	showCodeChoice: boolean;
}

const PairingQRModal = ({
	open,
	onOpenChange,
	code,
	isConnected,
	isConnecting,
	onDisconnect,
	lastCode,
	onUseLastCode,
	onUseNewCode,
	showCodeChoice,
}: PairingQRModalProps) => {
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [qrError, setQrError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const copyTimeoutRef = useRef<number | null>(null);
	const [justConnected, setJustConnected] = useState(false);
	const [animationTheme, setAnimationTheme] = useState<"light" | "dark">("light");
	const prevConnectedRef = useRef(isConnected);
	const [showConnectionHelp, setShowConnectionHelp] = useState(false);
	const connectionHelpTimeoutRef = useRef<number | null>(null);

	// Inject animation styles
	useEffect(() => {
		if (!document.getElementById("pairing-qr-animation")) {
			const style = document.createElement("style");
			style.id = "pairing-qr-animation";
			style.innerHTML = connectionAnimationStyles;
			document.head.appendChild(style);
		}
	}, []);

	// Track when connection state changes to trigger animation and auto-close
	useEffect(() => {
		if (isConnected && !prevConnectedRef.current) {
			const isDark = document.documentElement.classList.contains("dark");
			setAnimationTheme(isDark ? "dark" : "light");
			setJustConnected(true);

			// Reset after animation completes
			const animTimeout = window.setTimeout(() => setJustConnected(false), 600);

			// Close modal after 3 seconds
			const closeTimeout = window.setTimeout(() => onOpenChange(false), 3000);

			return () => {
				window.clearTimeout(animTimeout);
				window.clearTimeout(closeTimeout);
			};
		}

		prevConnectedRef.current = isConnected;
	}, [isConnected, onOpenChange]);

	// Show connection help after 20 seconds of waiting
	useEffect(() => {
		if (connectionHelpTimeoutRef.current) {
			window.clearTimeout(connectionHelpTimeoutRef.current);
			connectionHelpTimeoutRef.current = null;
		}

		if (isConnected || !open) {
			setShowConnectionHelp(false);
			return;
		}

		// Start timeout when we have a code and are waiting for connection
		if (code && !isConnected && !showCodeChoice) {
			connectionHelpTimeoutRef.current = window.setTimeout(() => {
				setShowConnectionHelp(true);
			}, 20000);
		}

		return () => {
			if (connectionHelpTimeoutRef.current) {
				window.clearTimeout(connectionHelpTimeoutRef.current);
			}
		};
	}, [code, isConnected, open, showCodeChoice]);

	// Generate QR code when code changes
	useEffect(() => {
		if (!code || !open) {
			setQrDataUrl(null);
			return;
		}

		const generateQR = async () => {
			try {
				const mobileUrl = `${window.location.origin}?code=${encodeURIComponent(code)}`;

				const dataUrl = await QRCode.toDataURL(mobileUrl, {
					width: 240,
					margin: 2,
					color: {
						dark: "#000000",
						light: "#ffffff",
					},
					errorCorrectionLevel: "M",
				});

				setQrDataUrl(dataUrl);
				setQrError(null);
			} catch {
				setQrError("Failed to generate QR code");
				setQrDataUrl(null);
			}
		};

		void generateQR();
	}, [code, open]);

	const handleDisconnect = () => {
		onDisconnect();
	};

	// Extract UUID from code for display
	const displayCode = code?.replace("webfsr-", "") ?? "";

	const handleCopyCode = async () => {
		if (!displayCode) return;

		try {
			await navigator.clipboard.writeText(displayCode);

			setCopied(true);

			if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);

			copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API not available
		}
	};

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
		};
	}, []);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md pb-4">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Smartphone className="size-5" />
						Pair Mobile Device
					</DialogTitle>
					<DialogDescription>
						{isConnected
							? "Mobile device connected! You can close this dialog."
							: "Scan a QR code or enter a code to pair your mobile device."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col items-center gap-6 py-1">
					{isConnected ? (
						// Connected state
						<div className="flex flex-col items-center gap-4">
							<div
								className="w-48 h-48 bg-green-50 dark:bg-green-950/30 rounded-xl flex items-center justify-center border border-green-200 dark:border-green-900"
								style={
									justConnected
										? {
												animation: `qr-to-check-container-${animationTheme} 400ms ease-out forwards`,
											}
										: undefined
								}
							>
								<CheckCircle2
									className="size-20 text-green-500"
									style={
										justConnected
											? {
													animation: `${animationTheme === "dark" ? "check-scale-in-dark" : "check-scale-in"} 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
												}
											: undefined
									}
								/>
							</div>
							<div
								className="text-center"
								style={
									justConnected
										? {
												animation: "success-text-fade 400ms ease-out 150ms both",
											}
										: undefined
								}
							>
								<p className="text-lg font-semibold text-green-600 dark:text-green-400">Connected</p>
								<p className="text-sm text-muted-foreground mt-1">Mobile device is controlling your pad</p>
							</div>
							<Button
								variant="outline"
								onClick={handleDisconnect}
								className="gap-2"
								style={
									justConnected
										? {
												animation: "success-text-fade 400ms ease-out 250ms both",
											}
										: undefined
								}
							>
								<Unplug className="size-4" />
								Disconnect
							</Button>
						</div>
					) : (showCodeChoice || !code) && lastCode ? (
						// Code choice state
						<div className="flex flex-col items-center gap-4 w-full">
							<div className="flex flex-col gap-3 w-full max-w-xs">
								<Button onClick={onUseLastCode} className="w-full h-12 gap-2">
									<History className="size-4" />
									Use Last Pairing Code
								</Button>
								<Button variant="outline" onClick={onUseNewCode} className="w-full h-12 gap-2">
									<Plus className="size-4" />
									Generate New Code
								</Button>
							</div>
						</div>
					) : isConnecting && !code ? (
						// Initializing connection state
						<div className="flex flex-col items-center gap-4">
							<div className="w-48 h-48 bg-muted rounded-xl flex items-center justify-center">
								<Loader2 className="size-12 animate-spin text-muted-foreground" />
							</div>
							<p className="text-sm text-muted-foreground">Setting up connection…</p>
						</div>
					) : (
						// Waiting for connection state
						<>
							{/* QR Code */}
							<div className="relative w-48 h-48 bg-white rounded-xl p-2 shadow-inner border">
								{qrDataUrl ? (
									<img src={qrDataUrl} alt="Scan to connect" className="w-full h-full rounded-lg" />
								) : qrError ? (
									<div className="w-full h-full flex items-center justify-center text-destructive text-sm text-center p-4">
										{qrError}
									</div>
								) : (
									<div className="w-full h-full flex items-center justify-center">
										<Loader2 className="size-8 animate-spin text-muted-foreground" />
									</div>
								)}
							</div>

							{/* Connection code */}
							{displayCode && (
								<div className="text-center w-full">
									<p className="text-sm text-muted-foreground mb-2">Or enter this code manually:</p>
									<div className="flex items-center gap-2 justify-center">
										<code className="text-xs font-mono text-foreground bg-muted px-3 py-2 rounded-lg select-all whitespace-nowrap overflow-x-auto max-w-full">
											{displayCode}
										</code>
										<Button variant="ghost" size="icon" onClick={handleCopyCode} aria-label="Copy code" className="shrink-0">
											<Copy className={`size-4 ${copied ? "text-green-500" : ""}`} />
										</Button>
									</div>
									{copied && (
										<p className="text-xs text-green-600 mt-1" aria-live="polite">
											Copied!
										</p>
									)}
								</div>
							)}

							{/* Security warning */}
							<div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg max-w-sm">
								<AlertTriangle className="size-4 text-amber-600 dark:text-amber-500 shrink-0" />
								<p className="text-xs text-amber-800 dark:text-amber-200">
									Keep this code private. <br /> Anyone with the code can connect to your session.
								</p>
							</div>

							{/* Waiting indicator */}
							<div className="flex items-center gap-2 text-muted-foreground">
								<Loader2 className="size-4 animate-spin" />
								<span className="text-sm">Waiting for connection…</span>
							</div>

							{/* Connection troubleshooting help */}
							{showConnectionHelp && (
								<div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg max-w-sm">
									<div className="text-xs text-blue-800 dark:text-blue-200">
										<div className="text-xs text-blue-800 dark:text-blue-200">
											<p className="font-medium mb-1">Can't connect?</p>
											<p className="text-xs">
												Check your WebRTC and firewall settings. <br /> Restrictive networks may prevent direct connections.
											</p>
										</div>
									</div>
								</div>
							)}
						</>
					)}
				</div>

				<div className="text-xs text-muted-foreground text-center border-t pt-4">
					{isConnected ? (
						<p>Threshold changes on mobile will sync to your pad</p>
					) : (
						<p>Open webfsr.com on your mobile device to connect</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default PairingQRModal;
