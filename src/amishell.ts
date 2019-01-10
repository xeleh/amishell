#!/usr/bin/env node

import * as cp from "child_process";
import * as net from "net";

var _emulator: string;
var _port: number;

export function config(emulator: string, port: number) {
	_emulator = emulator;
	_port = port;
}

export async function executeCommand(command: string, activate: boolean, timeout: number, 
  quiet: boolean = false): Promise<string> {
	if (activate) {
		activateEmulator();
		await sleep(250);
	}
	await createSocket();
	return await sendCommand(command, timeout, quiet);
}

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export function activateEmulator() {
	let script = "";
	switch (process.platform) {
	case "darwin":
	case "linux":
		script = "\"" + __dirname + "/../scripts/activate.sh" + "\" " + "fs-uae";
		break;
	case "win32":
		script = "cscript //nologo \"" + __dirname + "\\..\\scripts\\activate.vbs" + "\" ";
		switch (_emulator) {
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
		cp.exec(script, (error, stdout, stderr) => {
			if (error) {
				console.error(error.message);
			}
		});
	}
}

var socket: net.Socket;

async function createSocket() {
	return new Promise(resolve => {
		socket = net.createConnection(_port, "localhost", () => { 
			socket.setEncoding("ascii");
			resolve();
		});
		socket.on("error", (err) => {
			console.error("[Communication with Amiga emulator failed]");
			console.error(err.message);
			terminate(1);
		});
	});
}

export var eot : boolean = false;

async function sendCommand(command: string, timeout: number, quiet: boolean): Promise<string> {
	return new Promise<string>(resolve => {
		let result : string = "";
		let dataLength = 0;
		eot = false;
		let prompt = "";
		socket.on("data", (data) => {
			var response = data.toString();
			// AmigaDos sends ascii char SI (15) as EOT signal
			if (response.charCodeAt(0) == 15) {
				eot = true;
			}
			if (!eot) {
				response = response.replace("\r", "");
				// filter the command itself
				if (dataLength > command.length) {
					if (!quiet) {
						process.stdout.write(response);
					}
					result += response;
				}
				dataLength += response.length;
			} else {
				// wait for complete prompt
				prompt += response;
				if (prompt.lastIndexOf("> ") >= 0) {
					socket.setTimeout(10);
				}
			}
		});
		// the promise will be resolved on timeout
		socket.setTimeout(timeout);
		socket.on("timeout", () => {
			destroySocket();
			resolve(result);
		});
		// send the command
		socket.write(command + "\r");
	});
}

function destroySocket() {
	if (socket && !socket.destroyed) {
		socket.end();
		socket.destroy();
	}
}

export function terminate(code: number = 0) {
	destroySocket();
	process.exit(code);
}
