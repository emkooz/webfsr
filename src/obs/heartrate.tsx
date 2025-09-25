import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";

function HeartrateObsDemo() {
	return (
		<div className="min-h-screen w-screen flex items-center justify-center bg-transparent">
			<div className="px-4 py-3 rounded-lg border bg-white/70 text-gray-900 shadow-sm">
				<h1 className="text-lg font-semibold">OBS Heartrate demo</h1>
				<p className="text-sm text-gray-700">Example placeholder content</p>
			</div>
		</div>
	);
}

// biome-ignore lint/style/noNonNullAssertion: root will always exist in our entry HTML
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<HeartrateObsDemo />
	</StrictMode>,
);

