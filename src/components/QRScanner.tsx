import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { AlertTriangle, Camera, Keyboard, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";

interface QRScannerProps {
	onScan: (code: string) => void;
	onError?: (error: string) => void;
	onClose: () => void;
	onSwitchToCodeInput?: () => void;
}

// Validate that scanned data is a valid webfsr URL or code
const extractCode = (data: string): string | null => {
	// Try to parse as URL first
	try {
		const url = new URL(data);
		const codeParam = url.searchParams.get("code");

		if (codeParam && codeParam.startsWith("webfsr-")) return codeParam;
	} catch {
		// Not a URL
	}

	// Check if it's a direct code
	if (data.startsWith("webfsr-")) return data;

	// Check if it's just the UUID part
	const uuidRegex = /^[0-9a-f]{8}(-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i;
	if (uuidRegex.test(data)) return `webfsr-${data}`;

	return null;
};

const QRScanner = ({ onScan, onError, onClose, onSwitchToCodeInput }: QRScannerProps) => {
	const [hasPermission, setHasPermission] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [scannerSize, setScannerSize] = useState<number>(288);
	const scannerRef = useRef<Html5Qrcode | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const hasScannedRef = useRef(false);
	const isInitializingRef = useRef(false);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;

		const initScanner = async () => {
			if (isInitializingRef.current || !containerRef.current || !wrapperRef.current) return;
			isInitializingRef.current = true;

			const scannerId = "qr-scanner-viewport";
			const container = containerRef.current;

			// Ensure container has the ID
			container.id = scannerId;

			// Wait for the element to be fully laid out before starting the scanner.
			// html5-qrcode requires the element to have computed dimensions.
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						resolve();
					});
				});
			});

			// Check if component unmounted during the wait
			if (!isMountedRef.current) {
				isInitializingRef.current = false;
				return;
			}

			// Calculate the scanner size based on available space in the wrapper
			const wrapperRect = wrapperRef.current.getBoundingClientRect();

			// Use most of the available space, keeping it square and leaving some padding
			const availableSize = Math.min(wrapperRect.width - 32, wrapperRect.height - 32);
			const calculatedSize = Math.max(288, Math.floor(availableSize));
			setScannerSize(calculatedSize);

			// Wait another frame for the size state to apply
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => resolve());
			});

			if (!isMountedRef.current) {
				isInitializingRef.current = false;
				return;
			}

			// Verify the container has actual dimensions
			const rect = container.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) {
				setError("Scanner container not ready. Please try again.");
				isInitializingRef.current = false;
				return;
			}

			try {
				const scanner = new Html5Qrcode(scannerId, { verbose: false });
				scannerRef.current = scanner;

				// Calculate qrbox size based on actual container size
				const containerSize = Math.min(rect.width, rect.height);
				const qrboxSize = Math.floor(containerSize * 0.85);

				await scanner.start(
					{ facingMode: "environment" },
					{
						fps: 10,
						qrbox: { width: qrboxSize, height: qrboxSize },
					},
					(decodedText) => {
						// Prevent multiple scans
						if (hasScannedRef.current) return;

						const code = extractCode(decodedText);
						if (code) {
							hasScannedRef.current = true;
							onScan(code);
						}
					},
					() => {
						// QR code scan error (not found) - ignore these
					},
				);

				if (isMountedRef.current) {
					setHasPermission(true);
					setError(null);
				}
			} catch (err) {
				if (!isMountedRef.current) return;

				const message = err instanceof Error ? err.message : String(err);

				if (message.includes("Permission") || message.includes("NotAllowedError")) {
					setHasPermission(false);
					setError("Camera permission denied. Please allow camera access to scan QR codes.");
				} else if (message.includes("NotFoundError") || message.includes("no camera")) {
					setError("No camera found. Please use a device with a camera.");
				} else if (message.includes("NotReadableError") || message.includes("Could not start")) {
					setError("Camera is in use by another app. Please close other camera apps and try again.");
				} else if (message.includes("OverconstrainedError")) {
					setError("Camera does not support the requested settings. Please try a different device.");
				} else {
					setError(`Failed to start camera: ${message}`);
				}

				if (onError) onError(message);
			} finally {
				isInitializingRef.current = false;
			}
		};

		void initScanner();

		return () => {
			isMountedRef.current = false;
			const scanner = scannerRef.current;

			if (scanner) {
				const state = scanner.getState();

				if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
					void scanner.stop().catch(() => {
						// Ignore stop errors on cleanup
					});
				}

				scannerRef.current = null;
			}
		};
	}, [onScan, onError]);

	const handleClose = () => {
		const scanner = scannerRef.current;

		if (scanner) {
			const state = scanner.getState();

			if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) void scanner.stop().catch(() => {});
		}

		onClose();
	};

	return (
		<div className="h-dvh w-screen flex flex-col bg-black">
			{/* Header */}
			<div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-black/80">
				<h2 className="text-lg font-semibold text-white">Scan QR Code</h2>
				<Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleClose} aria-label="Cancel">
					<X className="size-6" />
				</Button>
			</div>

			{/* Scanner viewport */}
			<div ref={wrapperRef} className="flex-1 flex items-center justify-center p-4 overflow-hidden">
				{error ? (
					<div className="max-w-xs text-center">
						<div className="w-64 h-64 mx-auto mb-4 rounded-2xl border-2 border-red-500/50 flex items-center justify-center bg-red-950/20">
							<AlertTriangle className="size-16 text-red-400" />
						</div>
						<p className="text-white/90 mb-2">Camera Error</p>
						<p className="text-sm text-white/60 mb-4">{error}</p>
						{hasPermission === false && (
							<p className="text-xs text-white/40">Check your browser settings to allow camera access for this site.</p>
						)}
					</div>
				) : (
					<div className="relative">
						{/* Scanner container - explicit pixel dimensions for html5-qrcode */}
						<div
							ref={containerRef}
							style={{ width: scannerSize, height: scannerSize }}
							className="rounded-2xl overflow-hidden bg-black"
						/>

						{/* Loading overlay (shows while permission is pending) */}
						{hasPermission === null && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl">
								<div className="text-center">
									<Camera className="size-12 text-white/40 mx-auto mb-2 animate-pulse" />
									<p className="text-sm text-white/60">Starting camera…</p>
								</div>
							</div>
						)}

						{/* Corner accents overlay */}
						<div className="absolute inset-0 pointer-events-none">
							<div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-2xl" />
							<div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-2xl" />
							<div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-2xl" />
							<div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-2xl" />
						</div>
					</div>
				)}
			</div>

			{/* Instructions */}
			<div className="p-6 bg-black/80 text-center">
				<p className="text-white/90 mb-2">Point camera at QR code on desktop</p>
				<p className="text-sm text-white/50">QR code is shown in WebFSR pairing dialog</p>
			</div>

			{/* Footer */}
			{onSwitchToCodeInput && (
				<div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10">
					<Button variant="ghost" className="w-full text-white hover:bg-white/10" onClick={onSwitchToCodeInput}>
						<Keyboard className="size-4 mr-2" />
						Enter Code Manually Instead
					</Button>
				</div>
			)}
		</div>
	);
};

export default QRScanner;
