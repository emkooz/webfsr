<div align="center">
  <h1>WebFSR</h1>
</div>

### Web client for managing FSR pads running the [teejusb FSR firmware](https://github.com/teejusb/fsr).

## Features

-  Connect directly to the microcontroller without installing anything locally, through WebSerial (requires a Chromium-based browser).
-  View current sensor data and adjust thresholds.
-  Settings to adjust the visuals of the sensor bars and the time series graph.
-  Automatically save all settings and threshold values to profiles, stored using IndexedDB.
-  Display heartrate monitor data using WebBluetooth.
-  Installable as a PWA, allowing it to run in a dedicated window and offline.
-  OBS Browser Source components of each visualization to display in recordings or streams

## Screenshot

<img src="./screenshot.png" alt="WebFSR screenshot" />

## PWA Installation

WebFSR is installable as a PWA. This will allow you to run it offline and in a separate window, which is more convenient than managing it in a browser tab.

To install it as a PWA, find a button in the top-right corner of your browser which says "Install WebFSR":

<img src="./pwa.png" alt="Install WebFSR as PWA button" />

## OBS Browser Source Components

[!NOTE]
Minimizing or occluding the page will likely cause the websocket connection to be heavily throttled. Until a good mitigation for this is found, bring the tab/PWA into focus, and then open ITG without focusing any other window.

Each visualization can be loaded in a separate route to display in an OBS Browser Source. This allows for high quality stream elements without resorting to using Window Capture.

This feature works by using the websocket server built into OBS. Each route connects as a client, and the main page sends data to each of the component pages through obs-websocket.

Steps to use the OBS Browser Source components:
1. Enable the OBS websocket server by going to Tools > WebSocket Server Settings > Enable WebSocket Server
2. Copy the password under Server Password
3. In the main page under the OBS section, paste the password
4. Customize a component using the "Create component" button in the OBS section
5. Copy the generated link and paste that into the source URL for an OBS Browser Source

Components are located at the route `/obs/{visualization}/`. 

List of the current routes:
-  `/obs/sensors/`
-  `/obs/graph/`

## Use cases which are not covered

-  WebFSR must be used on the same device that the pad is connected to. If you are trying to adjust thresholds from another device (such as a phone), you must use the standard teejusb FSR web UI setup.

## Future TODO

-  Integration with ITGmania
   -  Send real-time theme data to the client. This would allow for more in-depth statistical analysis which would support in pad debugging. For example, each miss can be sent to the client, connecting a miss in game with a specific sensor value.
   -  This would be accomplished with a websocket server running locally on the machine, which will receive data from a theme module and pass it along to the client.
-  Import profiles saved from teejusb FSR web UI.
-  Dark mode
-  Control thresholds from external devices using WebRTC
