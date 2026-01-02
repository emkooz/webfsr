# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Building and running:**

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm preview          # Preview production build
```

**Linting and formatting:**

- Use Biome for linting (configured in `biome.json`)
- No explicit test commands are configured

## Architecture Overview

### Purpose

WebFSR is a React PWA for controlling FSR (Force Sensitive Resistor) dance pads via WebSerial. It reads real-time sensor data from a microcontroller, displays visualizations, and allows threshold adjustments. The app is deployed to GitHub Pages and works offline as a PWA.

### Tech Stack

- **React 19** with React Compiler (memo, useMemo, useCallback are unnecessary)
- **Vite** multi-page app (main + 3 OBS component pages)
- **TailwindCSS 4** for styling
- **Zustand** for state management
- **IndexedDB** (via idb) for persistent storage of profiles/settings
- **Shadcn components** for UI primitives
- **WebSerial** for microcontroller communication
- **WebBluetooth** for optional heart rate monitor
- **obs-websocket-js** for streaming sensor data to OBS Browser Sources

### Core Architecture Patterns

**Performance-critical data flow:**

- Serial data updates at very high frequency (~100 requests/second by default)
- Components that don't need live sensor data MUST NOT re-render on sensor updates
- Only visualizations (SensorBar, TimeSeriesGraph) subscribe to live data
- Sidebar settings are isolated from the sensor data stream

**State management:**

- **Zustand store** (`/store`): Global state (e.g., `dataStore.ts` tracks sensor count)
- **IndexedDB** (`useProfileManager.ts`): Persistent user settings and profiles
- **Local component state**: For UI-only state that doesn't need persistence

**File organization:**

- `/components` - Large components (SensorBar, TimeSeriesGraph), Shadcn UI in `/components/ui`
- `/lib` - Pure TypeScript implementations (useSerialPort, useOBS, useProfileManager, useHeartrateMonitor)
- `/store` - Zustand stores
- `/obs` - Standalone OBS Browser Source component pages (graph, sensors, heartrate)
- `dashboard.tsx` - Main app page
- `DashboardSidebar.tsx` - Sidebar configuration sections

### Key Systems

**Serial Port Communication (`useSerialPort.ts`):**

- Continuously polls microcontroller for sensor values
- Configurable polling rate (default 100 req/s, or unthrottled)
- Sends threshold updates back to the device
- Detects sensor count on first data read

**OBS Integration (`useOBS.ts`):**

- Main PWA connects to local OBS websocket server (default: ws://127.0.0.1:4455)
- Broadcasts sensor values + thresholds via CustomEvent
- OBS component pages (`/obs/*`) listen to these events and render visualizations
- Supports auto-reconnect with exponential backoff
- Components are configured via query parameters (e.g., `/obs/graph?window=10000`)

**Profile Management (`useProfileManager.ts`):**

- All user settings stored in IndexedDB with profiles
- Profile data includes sensor colors, thresholds, labels, visualization settings, OBS password
- Automatic profile creation on first use
- Last active profile persists across sessions

**Multi-page Build:**

- Vite builds 4 separate HTML pages (see `vite.config.ts` rollupOptions):
   - `main` - Dashboard PWA
   - `obsGraph` - Graph component for OBS
   - `obsSensors` - Sensor bars for OBS
   - `obsHeartrate` - Heart rate monitor for OBS

### Design Guidelines

**UI/UX rules (from `.cursor/rules/design-guideline.mdc`):**

- Minimize re-renders (critical for real-time performance)
- Use compositor-friendly animations (transform, opacity only)
- Keep useEffect usage minimal
- No code comments on trivial lines, only non-obvious logic
- Accessible design: APCA contrast, redundant status cues, semantic HTML

**React-specific:**

- React 19 + React Compiler enabled - don't use memo/useMemo/useCallback
- Prefer uncontrolled inputs where possible
- Keep controlled input loops cheap (keystroke performance)

### Important Constraints

**WebSerial usage:**

- App must be used on the same device as the connected pad (no remote control)
- Requires Chromium-based browser
- Use Chromium-specific APIs (WebSerial, WebBluetooth) without fallbacks

**OBS Browser Source considerations:**

- Minimizing/occluding the page throttles websocket connections
- Users should keep the PWA tab/window in focus during streaming

### Path Aliases

- `@` and `~` both resolve to `/src`

### Build Metadata

The build injects these constants (see `vite.config.ts`):

- `__BUILD_TIMESTAMP__`
- `__APP_NAME__`
- `__REPO_URL__`
- `__COMMIT_HASH__`
- `__BUILD_MODE__`
