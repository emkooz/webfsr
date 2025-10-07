import { type IDBPDatabase, openDB } from "idb";
import { useEffect, useState } from "react";

// Database configuration
const DB_NAME = "webfsr";
const DB_VERSION = 1;
const PROFILES_STORE = "profiles";
const SETTINGS_STORE = "settings";

// Interface for profile data
export interface ProfileData {
	id?: number;
	name: string;
	createdAt: number;
	updatedAt: number;
	sensorColors: string[];
	showBarThresholdText: boolean;
	showBarValueText: boolean;
	thresholdColor: string;
	useThresholdColor: boolean;
	useSingleColor: boolean;
	singleBarColor: string;
	useBarGradient: boolean;
	showGridLines: boolean;
	showThresholdLines: boolean;
	thresholdLineOpacity: number;
	showLegend: boolean;
	showGraphBorder: boolean;
	timeWindow: number;
	thresholds: number[];
	sensorLabels: string[];
	showHeartrateMonitor: boolean;
	lockThresholds: boolean;
	showGraphActivation: boolean;
	graphActivationColor: string;
	verticalAlignHeartrate: boolean;
	fillHeartIcon: boolean;
	showBpmText: boolean;
	animateHeartbeat: boolean;
	pollingRate: number;
	useUnthrottledPolling: boolean;
	obsPassword?: string;
	obsSendRate?: number;
	obsAutoConnect?: boolean;
}

export const DEFAULT_PROFILE: Omit<ProfileData, "id" | "createdAt" | "updatedAt"> = {
	name: "Default Profile",
	sensorColors: [
		"#3a7da3", // blue
		"#d4607c", // pink
		"#8670d4", // purple
		"#d49b20", // gold
		"#459ea0", // teal
		"#d45478", // coral
	],
	showBarThresholdText: true,
	showBarValueText: true,
	thresholdColor: "#4dd253",
	useThresholdColor: true,
	useSingleColor: true,
	singleBarColor: "#3a7da3", // Same as first sensor color
	useBarGradient: true,
	showGridLines: true,
	showThresholdLines: true,
	thresholdLineOpacity: 0.3,
	showLegend: true,
	showGraphBorder: true,
	timeWindow: 1000,
	thresholds: [],
	sensorLabels: [],
	showHeartrateMonitor: false,
	lockThresholds: false,
	showGraphActivation: true,
	graphActivationColor: "#4dd253",
	verticalAlignHeartrate: false,
	fillHeartIcon: true,
	showBpmText: true,
	animateHeartbeat: true,
	pollingRate: 100,
	useUnthrottledPolling: false,
	obsPassword: "",
	obsSendRate: 60,
	obsAutoConnect: true,
};

export function useProfileManager() {
	const [db, setDb] = useState<IDBPDatabase | null>(null);
	const [profiles, setProfiles] = useState<ProfileData[]>([]);
	const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
	const [activeProfile, setActiveProfile] = useState<ProfileData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Helper function to save the last active profile ID
	const saveLastActiveProfileId = async (database: IDBPDatabase, profileId: number) => {
		try {
			// Check if we already have a setting
			const existingSetting = await database.getFromIndex(SETTINGS_STORE, "key", "lastActiveProfileId");

			if (existingSetting) {
				// Update existing setting
				await database.put(SETTINGS_STORE, {
					...existingSetting,
					value: profileId,
				});
			} else {
				// Create new setting
				await database.add(SETTINGS_STORE, {
					key: "lastActiveProfileId",
					value: profileId,
				});
			}
		} catch (err) {
			console.error("Failed to save last active profile ID:", err);
		}
	};

	// Initialize the database
	useEffect(() => {
		const initDb = async () => {
			try {
				const database = await openDB(DB_NAME, DB_VERSION, {
					upgrade(db) {
						// Create object stores if they don't exist
						if (!db.objectStoreNames.contains(PROFILES_STORE)) {
							const profileStore = db.createObjectStore(PROFILES_STORE, {
								keyPath: "id",
								autoIncrement: true,
							});
							profileStore.createIndex("name", "name", { unique: false });
							profileStore.createIndex("updatedAt", "updatedAt", { unique: false });
						}

						if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
							const settingsStore = db.createObjectStore(SETTINGS_STORE, {
								keyPath: "id",
								autoIncrement: true,
							});
							settingsStore.createIndex("key", "key", { unique: true });
						}
					},
				});

				setDb(database);

				// Load all profiles
				let allProfiles = await database.getAll(PROFILES_STORE);
				setProfiles(allProfiles as ProfileData[]);

				const lastActiveProfileSetting = await database.getFromIndex(SETTINGS_STORE, "key", "lastActiveProfileId");

				// If we don't have any profiles or a last active profile, create a default profile
				if (allProfiles.length === 0) {
					let shouldCreateDefault = false;

					try {
						// Attempt to mark bootstrap
						await database.add(SETTINGS_STORE, { key: "bootstrapped", value: Date.now() });
						shouldCreateDefault = true;
					} catch {
						shouldCreateDefault = false;
					}

					if (shouldCreateDefault) {
						const timestamp = Date.now();
						const defaultProfileWithTimestamps = {
							...DEFAULT_PROFILE,
							createdAt: timestamp,
							updatedAt: timestamp,
						};

						const id = await database.add(PROFILES_STORE, defaultProfileWithTimestamps);
						const newProfile = { ...defaultProfileWithTimestamps, id: id as number };

						setProfiles([newProfile]);
						setActiveProfileId(id as number);
						setActiveProfile(newProfile);

						await saveLastActiveProfileId(database, id as number);
					} else {
						// Another instance is bootstrapping; refetch
						await new Promise((r) => setTimeout(r, 50));
						allProfiles = (await database.getAll(PROFILES_STORE)) as ProfileData[];
						setProfiles(allProfiles);
					}
				} else if (lastActiveProfileSetting) {
					// We have a last active profile, load it
					const profileId = lastActiveProfileSetting.value as number;
					const profile = await database.get(PROFILES_STORE, profileId);

					if (profile) {
						setActiveProfileId(profileId);
						setActiveProfile(profile as ProfileData);
					} else {
						// If the profile doesn't exist anymore, use the first available profile
						const firstId = allProfiles[0].id;

						if (firstId !== undefined) {
							setActiveProfileId(firstId as number);
							setActiveProfile(allProfiles[0] as ProfileData);
							await saveLastActiveProfileId(database, firstId as number);
						}
					}
				} else {
					// No last active profile setting, use the first profile
					const firstId = allProfiles[0].id;

					if (firstId !== undefined) {
						setActiveProfileId(firstId as number);
						setActiveProfile(allProfiles[0] as ProfileData);
						await saveLastActiveProfileId(database, firstId as number);
					}
				}

				setIsLoading(false);
			} catch (err) {
				console.error("Failed to initialize IndexedDB:", err);
				setError("Failed to initialize profile database");
				setIsLoading(false);
			}
		};

		initDb();
	}, []);

	// Create a new profile
	const createProfile = async (name: string, baseProfileId?: number) => {
		if (!db) return null;

		try {
			let baseProfile: Partial<ProfileData> = DEFAULT_PROFILE;

			// If a base profile ID is provided, use that profile as a base
			if (baseProfileId) {
				const existingProfile = await db.get(PROFILES_STORE, baseProfileId);

				if (existingProfile) {
					// Remove id to create a new profile
					const { id, ...rest } = existingProfile as ProfileData;
					baseProfile = rest;
				}
			}

			const timestamp = Date.now();
			const newProfile = {
				...baseProfile,
				name,
				createdAt: timestamp,
				updatedAt: timestamp,
			};

			const id = await db.add(PROFILES_STORE, newProfile);
			const profileWithId = { ...newProfile, id: id as number };

			setProfiles((prev) => [...prev, profileWithId as ProfileData]);

			return profileWithId as ProfileData;
		} catch (err) {
			console.error("Failed to create profile:", err);
			setError("Failed to create profile");
			return null;
		}
	};

	// Delete a profile
	const deleteProfile = async (id: number) => {
		if (!db) return;

		try {
			// Don't allow deleting the last profile
			if (profiles.length <= 1) {
				setError("Cannot delete the last profile");
				return;
			}

			await db.delete(PROFILES_STORE, id);

			// Update profiles state
			setProfiles((prev) => prev.filter((profile) => profile.id !== id));

			// If the active profile is being deleted, switch to another profile
			if (activeProfileId === id) {
				const remainingProfiles = profiles.filter((profile) => profile.id !== id);

				if (remainingProfiles.length > 0) {
					const newActiveProfile = remainingProfiles[0];
					const newId = newActiveProfile.id;

					if (newId !== undefined) {
						setActiveProfileId(newId);
						setActiveProfile(newActiveProfile);
						await saveLastActiveProfileId(db, newId);
					}
				}
			}
		} catch (err) {
			console.error("Failed to delete profile:", err);
			setError("Failed to delete profile");
		}
	};

	// Update a profile
	const updateProfile = async (id: number, updates: Partial<Omit<ProfileData, "id" | "createdAt" | "updatedAt">>) => {
		if (!db) return;

		try {
			const existingProfile = await db.get(PROFILES_STORE, id);
			if (!existingProfile) {
				setError("Profile not found");
				return;
			}

			const updatedProfile = {
				...existingProfile,
				...updates,
				updatedAt: Date.now(),
			};

			await db.put(PROFILES_STORE, updatedProfile);

			// Update profiles state
			setProfiles((prev) => prev.map((profile) => (profile.id === id ? (updatedProfile as ProfileData) : profile)));

			// If this is the active profile, update the active profile state
			if (activeProfileId === id) setActiveProfile(updatedProfile as ProfileData);
		} catch (err) {
			console.error("Failed to update profile:", err);
			setError("Failed to update profile");
		}
	};

	// Set active profile
	const setActiveProfileById = async (id: number) => {
		if (!db) return;

		try {
			const profile = await db.get(PROFILES_STORE, id);

			if (!profile) {
				setError("Profile not found");
				return;
			}

			setActiveProfileId(id);
			setActiveProfile(profile as ProfileData);

			await saveLastActiveProfileId(db, id);
		} catch (err) {
			console.error("Failed to set active profile:", err);
			setError("Failed to set active profile");
		}
	};

	// Update thresholds for active profile
	const updateThresholds = async (newThresholds: number[]) => {
		if (!activeProfileId || !db) return;

		try {
			await updateProfile(activeProfileId, { thresholds: newThresholds });
		} catch (err) {
			console.error("Failed to update thresholds:", err);
		}
	};

	// Update sensor labels for active profile
	const updateSensorLabels = async (newLabels: string[]) => {
		if (!activeProfileId || !db) return;

		try {
			await updateProfile(activeProfileId, { sensorLabels: newLabels });
		} catch (err) {
			console.error("Failed to update sensor labels:", err);
		}
	};

	// Reset profile to default values except name, id, timestamps
	const resetProfileToDefaults = async (id: number) => {
		if (!db) return null;

		try {
			const existingProfile = await db.get(PROFILES_STORE, id);
			if (!existingProfile) {
				setError("Profile not found");
				return null;
			}

			const { name, id: profileId, createdAt } = existingProfile as ProfileData;

			const updatedProfile = {
				...DEFAULT_PROFILE,
				thresholds: existingProfile.thresholds,
				sensorLabels: existingProfile.sensorLabels,
				obsPassword: (existingProfile as ProfileData).obsPassword ?? "",
				obsSendRate: (existingProfile as ProfileData).obsSendRate ?? 30,
				obsAutoConnect: (existingProfile as ProfileData).obsAutoConnect ?? false,
				name,
				id: profileId,
				createdAt,
				updatedAt: Date.now(),
			};

			await db.put(PROFILES_STORE, updatedProfile);

			// Update profiles state
			setProfiles((prev) => prev.map((profile) => (profile.id === id ? (updatedProfile as ProfileData) : profile)));

			// If this is the active profile, update the active profile state
			if (activeProfileId === id) setActiveProfile(updatedProfile as ProfileData);

			return updatedProfile as ProfileData;
		} catch (err) {
			console.error("Failed to reset profile:", err);
			setError("Failed to reset profile");
			return null;
		}
	};

	return {
		profiles,
		activeProfile,
		activeProfileId,
		isLoading,
		error,
		createProfile,
		deleteProfile,
		updateProfile,
		setActiveProfileById,
		updateThresholds,
		updateSensorLabels,
		resetProfileToDefaults,
	};
}
