const supported = "serial" in navigator;
document.getElementById("webserial-unsupported-check")!.style.display = supported ? "none" : "flex";

if (supported) main();

function main() {
	let port: SerialPort | null = null;
	let connected = false;
	const requestData = new Uint8Array([118, 10]);

	const btnConnect = document.getElementById("btn-connect")! as HTMLButtonElement;
	const btnDisconnect = document.getElementById("btn-disconnect")! as HTMLButtonElement;

	const ctx = (document.getElementById("canvas") as HTMLCanvasElement).getContext("2d")!;
	const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
	grad.addColorStop(0, "#f2f486");
	grad.addColorStop(0.75, "#b43358");
	grad.addColorStop(1, "#140b36");

	let reads = 0;

	setInterval(() => {
		document.getElementById("read-rate")!.textContent = `${reads} value requests/s`;
		reads = 0;
	}, 1000);

	document.getElementById("btn-select")!.addEventListener("click", async () => {
		try {
			port = await navigator.serial.requestPort();
			btnConnect.disabled = false;

			const info = port.getInfo();
			document.getElementById("port-info")!.textContent = `Connected port info: \n${JSON.stringify(info, null, "\t")}`;
		} catch (e) {
			console.error(e);
		}
		console.log(port);
	});

	document.getElementById("btn-connect")!.addEventListener("click", async () => {
		if (port) {
			await port.open({ baudRate: 9600 });
			btnConnect.disabled = true;
			btnDisconnect.disabled = false;
			connected = true;

			const decoder = new TextDecoder();
			const output = document.getElementById("output")!;

			let buffer = "\n";

			while (port.readable && connected) {
				const reader = port.readable.getReader();
				const writer = port.writable.getWriter();

				try {
					while (true) {
						if (buffer.endsWith("\n")) {
							await writer.write(requestData);
							output.textContent = buffer;
							buffer = "";
							reads += 1;

							// update canvas
							const values = output
								.textContent!.split(" ")
								.slice(1)
								.map((v) => parseInt(v));

							ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
							ctx.fillStyle = grad;

							for (const [i, value] of values.entries()) {
								ctx.fillRect(
									(i / values.length) * ctx.canvas.width,
									ctx.canvas.height,
									ctx.canvas.width / values.length,
									(-value / 1023) * ctx.canvas.height
								);
							}
						}

						const { value, done } = await reader.read();
						buffer += decoder.decode(value);

						if (done || !connected) break;
					}
				} catch (e) {
					console.error(e);
				} finally {
					reader.releaseLock();
					writer.releaseLock();
				}
			}

			await port.close();
		}
	});

	document.getElementById("btn-disconnect")!.addEventListener("click", () => {
		connected = false;
		btnConnect.disabled = false;
		btnDisconnect.disabled = true;
	});
}
