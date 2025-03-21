<div align="center">
  <h1>WebFSR</h1>
</div>

### Web client for managing FSR pads running the [teejusb FSR firmware](https://github.com/teejusb/fsr).

## Features
- Connect directly to the microcontroller without installing anything locally, through WebSerial (requires a Chromium-based browser).
- View current sensor data and adjust thresholds.
- Number of settings to adjust the visuals of the sensor bars and the time series graph.
- Automatically save all settings and threshold values to profiles, stored using IndexedDB.

## Use cases which are not covered
- WebFSR must be used on the same device that the pad is connected to. If you are trying to adjust thresholds from another device (such as a phone), you must used the standard teejusb FSR web UI setup.
- Opening up multiple instances does not work, since only one serial connection can be made at a time. For OBS, this means that you cannot use a browser source to display the visualizations, and instead will have to do it manually through window capture.

## Future TODO
- Integration with ITGmania
  - Send real-time theme data to the client. This would allow for more in-depth statistical analysis which would support in pad debugging. For example, each miss can be sent to the client, being able connect a miss in game with a specific sensor value.
  - This would be accomplished with a websocket server running locally on the machine, which will receive data from a theme module and pass it along to the client.
- WebBluetooth
  - This would be added to support heartrate trackers so that that data can be displayed.
- Import profiles saved from teejusb FSR web UI.
- Dark mode and customize different elements to better suit displaying in OBS.
