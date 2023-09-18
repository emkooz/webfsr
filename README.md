Demo interfacing with the [teejusb FSR firmware](https://github.com/teejusb/fsr) using WebSerial. Only works on Chromium-based browsers as of 2023.

Preview:

<img src="./demo.gif">

## build instructions

install node and pnpm

run `pnpm i`

run `pnpm dev` for the local dev server

run `pnpm build` to build the project for deployment, edit `base` in vite.config.js to the url the page will be hosted on
