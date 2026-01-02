import { type IDBPDatabase, openDB } from "idb";
import { useEffect, useState } from "react";

const DB_NAME = "webfsr";
const DB_VERSION = 1;
const SETTINGS_STORE = "settings";
const THEME_KEY = "theme";

export type Theme = "light" | "dark" | "system";

const getSystemTheme = (): "light" | "dark" => {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (theme: "light" | "dark") => {
	const root = document.documentElement;
	if (theme === "dark") {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
};

const resolveTheme = (theme: Theme): "light" | "dark" => {
	if (theme === "system") return getSystemTheme();

	return theme;
};

export function useTheme() {
	const [theme, setThemeState] = useState<Theme>("system");
	const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => getSystemTheme());
	const [isLoading, setIsLoading] = useState(true);
	const [db, setDb] = useState<IDBPDatabase | null>(null);

	useEffect(() => {
		const initTheme = async () => {
			try {
				const database = await openDB(DB_NAME, DB_VERSION);
				setDb(database);

				const themeSetting = await database.getFromIndex(SETTINGS_STORE, "key", THEME_KEY);
				const savedTheme = (themeSetting?.value as Theme) || "system";

				setThemeState(savedTheme);
				const resolved = resolveTheme(savedTheme);
				setResolvedTheme(resolved);
				applyTheme(resolved);
			} catch (error) {
				console.error("Failed to load theme from IndexedDB:", error);
				const fallbackResolved = getSystemTheme();
				setResolvedTheme(fallbackResolved);
				applyTheme(fallbackResolved);
			} finally {
				setIsLoading(false);
			}
		};

		initTheme();
	}, []);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		const handleChange = (e: MediaQueryListEvent) => {
			if (theme === "system") {
				const newResolved = e.matches ? "dark" : "light";
				setResolvedTheme(newResolved);
				applyTheme(newResolved);
			}
		};

		mediaQuery.addEventListener("change", handleChange);

		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	useEffect(() => {
		const resolved = resolveTheme(theme);
		setResolvedTheme(resolved);
		applyTheme(resolved);
	}, [theme]);

	const setTheme = async (newTheme: Theme) => {
		setThemeState(newTheme);

		if (!db) {
			console.warn("IndexedDB not initialized, theme preference will not persist");
			return;
		}

		try {
			const existingSetting = await db.getFromIndex(SETTINGS_STORE, "key", THEME_KEY);

			if (existingSetting) {
				await db.put(SETTINGS_STORE, { ...existingSetting, value: newTheme });
			} else {
				await db.add(SETTINGS_STORE, { key: THEME_KEY, value: newTheme });
			}
		} catch (error) {
			console.error("Failed to save theme to IndexedDB:", error);
		}
	};

	return {
		theme,
		resolvedTheme,
		setTheme,
		isLoading,
	};
}
