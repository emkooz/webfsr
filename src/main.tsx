import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Dashboard from "./dashboard.tsx";

// biome-ignore lint/style/noNonNullAssertion: root will always exist
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Dashboard />
	</StrictMode>,
);
