#!/usr/bin/env node

import * as cp from "child_process";
import * as net from "net";
import { debug } from "util";

enum Platform { Mac, Windows, Linux }

const platform = process.platform === "darwin" ? Platform.Mac : 
  process.platform === "win32" ? Platform.Windows : Platform.Linux;

if (process.argv.length == 2) {
	showHelp();
	process.exit();
}
parseArgs();

function parseArgs() {
	let emulator = platform == Platform.Windows ? "winuae" : "fsuae";
	const optionDefinitions = [
	{ name: 'activate', alias: 'a', type: Boolean, defaultValue: false },
	{ name: 'emulator', alias: 'e', type: String, defaultValue: emulator },
	{ name: 'port', alias: 'p', type: Number, defaultValue: 1234 },
	{ name: 'timeout', alias: 't', type: Number, defaultValue: 500 },
	{ name: 'command', type: String, defaultOption: true }];
	const cliArgs = require('command-line-args');
	const args = cliArgs(optionDefinitions);
	if (typeof args.command === "undefined" || args.command == "") {
		console.error("no command given!");
		process.exit(1);
	}
	executeCommand(args.command, args.port, args.activate, args.emulator, args.timeout);
}

function showHelp() {
	console.log("Executes a command in the specified Amiga emulator.")
	console.log("Usage: [options] <command>");
	console.log("\nOptions");
	console.log("-a, --activate             Activate (send to front) the emulator window");
	console.log("-e, --emulator <emulator>  Emulator in use (fsuae or winuae)");
	console.log("-p, --port     <port>      Virtual serial port used by the emulator (default = 1234)");
	console.log("-t, --timeout  <timeout>   Timeout in milliseconds (default = 500)");
}

function executeCommand(command: string, port: number, activate: boolean, emulator: string, 
  timeout: number) {
	if (activate) {
		activateEmulator(emulator);
	}
	setTimeout( () => { sendCommand(command, port, timeout); }, activate ? 500 : 0);
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
