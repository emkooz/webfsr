import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
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
				start_url: "/webfsr/",
				display: "standalone",
				scope: "/webfsr/",
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
	base: "/webfsr/",
});
