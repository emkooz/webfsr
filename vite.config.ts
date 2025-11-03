import { execSync } from "node:child_process";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
	appType: "mpa",
	define: {
		__BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
		__APP_NAME__: JSON.stringify("WebFSR"),
		__REPO_URL__: JSON.stringify("https://github.com/emkooz/webfsr"),
		__COMMIT_HASH__: JSON.stringify(
			(() => {
				try {
					return execSync("git rev-parse --short HEAD").toString().trim();
				} catch {
					return "";
				}
			})(),
		),
		__BUILD_MODE__: JSON.stringify(process.env.NODE_ENV || "development"),
	},
	plugins: [
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", {}]],
			},
		}),
		tailwindcss(),
		VitePWA({
			registerType: "autoUpdate",
			injectRegister: "auto",
			devOptions: {
				enabled: true,
			},
			includeAssets: [
				"favicon.ico",
				"apple-touch-icon-180x180.png",
				"pwa-64x64.png",
				"pwa-192x192.png",
				"pwa-512x512.png",
				"maskable-icon-512x512.png",
			],
			manifest: {
				name: "WebFSR",
				short_name: "WebFSR",
				description: "WebFSR",
				start_url: "./",
				display: "standalone",
				scope: "./",
				theme_color: "#333333",
				background_color: "#333333",
				icons: [
					{
						src: "pwa-64x64.png",
						sizes: "64x64",
						type: "image/png",
					},
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"~": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		rollupOptions: {
			input: {
				main: path.resolve(__dirname, "index.html"),
				obsGraph: path.resolve(__dirname, "obs/graph/index.html"),
				obsSensors: path.resolve(__dirname, "obs/sensors/index.html"),
				obsHeartrate: path.resolve(__dirname, "obs/heartrate/index.html"),
			},
		},
	},
	base: "./",
});
