#!/usr/bin/env node

import * as cp from "child_process";
import * as net from "net";

enum Platform { Mac, Windows, Linux }

const versionLabel = "1.0";

const platform = process.platform === "darwin" ? Platform.Mac : 
  process.platform === "win32" ? Platform.Windows : Platform.Linux;

parseArgs();

function parseArgs() {
	let emulator = platform == Platform.Windows ? "winuae" : "fsuae";
	const optionDefinitions = [
	  { name: 'activate', alias: 'a', type: Boolean, defaultValue: false },
	  { name: 'emulator', alias: 'e', type: String, defaultValue: emulator },
	  { name: 'help', alias: 'h', type: Boolean },
	  { name: 'port', alias: 'p', type: Number, defaultValue: 1234 },
	  { name: 'timeout', alias: 't', type: Number, defaultValue: 500 },
	  { name: 'version', alias: 'v', type: Boolean },
	  { name: 'command', type: String, defaultOption: true }
	];
	const cliArgs = require('command-line-args');
	const args = cliArgs(optionDefinitions);
	if (args.help) {
		help();
		process.exit(0);
	}
	if (args.version) {
		version();
		process.exit(0);
	}
	if (typeof args.command === "undefined" || args.command == "") {
		interactive(args.port, args.activate, args.emulator, args.timeout);
	} else {
		executeCommand(args.command, args.port, args.activate, args.emulator, args.timeout);
	}
}

function help() {
	console.log("Executes commands in a running Amiga emulator.")
	console.log("Usage: [options] <command>");
	console.log("\nOptions");
	console.log("-a, --activate             Activate (send to front) the emulator window");
	console.log("-e, --emulator <emulator>  Emulator in use (fsuae or winuae)");
	console.log("-h, --help                 Show this help");
	console.log("-p, --port     <port>      Port used by the emulator for serial comm. (default = 1234)");
	console.log("-t, --timeout  <timeout>   Timeout in milliseconds (default = 500)");
	console.log("-v, --version              Show the version number");
}

function executeCommand(command: string, port: number, activate: boolean, emulator: string, 
  timeout: number) {
	if (activate) {
		activateEmulator(emulator);
	}
	setTimeout( () => { sendCommand(command, port, timeout); }, activate ? 500 : 0);
function version() {
	console.log("AmiShell v" + versionLabel);
}

function interactive(port: number, activate: boolean, emulator: string, timeout: number) {
}
}

function activateEmulator(emulator: string) {
	let script = "";
	switch (platform) {
	case Platform.Mac:
	case Platform.Linux:
		script = "\"" + __dirname + "/../scripts/activate.sh" + "\" " + "fs-uae";
		console.log(script);
		break;
	case Platform.Windows:
		script = "cscript //nologo \"" + __dirname + "\\..\\scripts\\activate.vbs" + "\" ";
		switch (emulator) {
		case "fsuae":
			script += "fs-uae.exe";
			break;
		case "winuae":
			script += "winuae.exe winuae64.exe";
			break;
		}
		break;
	}
	if (script != "") {
		exec(script);
	}
}

function exec(command: string) {
	if (command) {
		cp.exec(command, (error, stdout, stderr) => {
			if (error) {
				console.error(error.message);
			}
		});
	}
}

var socket: net.Socket;

var connected: boolean;

enum State {
	awaitSI,
	awaitCR,
	awaitSPACE
}

var state: State = State.awaitSI;

function sendCommand(command: string, port: number, timeout: number) {
	let received = 0;
	socket = net.createConnection(port, "localhost", () => {
		connected = true;
		socket.setEncoding("ascii");
		send(command);
	});
	let timer = restartTimeout(timeout);
	socket.on("data", (data) => {
		// send command results (except the AmigaDos prompt chars) to console
		var response = data.toString();
		let char = response.charCodeAt(0);
		switch (state) {
		case State.awaitSI:
			response = response.replace("\r", "");
			if (char == 15) {
				state = State.awaitCR;
			} else {
				if (received > command.length) {
					process.stdout.write(response);
				}
				received += response.length;
				clearTimeout(timer);
				timer = restartTimeout(timeout);
			}
			break;
		case State.awaitCR:
			if (char == 13) {
				state = State.awaitSPACE;
			}
			break;
		case State.awaitSPACE:
			if (char == 32) {
				state = State.awaitSI;
			}
			break;
		}
	});
	socket.on("error", (err) => {
		console.error("Communication with Amiga emulator failed:");
		console.error(err.message);
		destroySocket()
		process.exit();
	});
	socket.on("close", () => {
		if (connected) {
			connected = false;
		}
		destroySocket();
	});
}

function restartTimeout(timeout: number): NodeJS.Timer {
	return setTimeout( () => { 
		destroySocket();
		process.exit();
	}, timeout);
}

function send(command: string) {
	state = State.awaitSI;
	socket.write(command + "\r");
}

function destroySocket() {
	if (socket && !socket.destroyed) {
		socket.destroy();
	}
	connected = false;
}
