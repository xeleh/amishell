#!/usr/bin/env node

import * as cp from "child_process";
import * as net from "net";
import * as readline from "readline";

const versionLabel = "1.0";

enum Platform { Mac, Windows, Linux }

const platform = process.platform === "darwin" ? Platform.Mac : 
  process.platform === "win32" ? Platform.Windows : Platform.Linux;

parseArgs();

async function parseArgs() {
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
	const args = cliArgs(optionDefinitions, { partial: true });
	if (args._unknown && args._unknown.length > 0) {
		console.log("amishell: unrecognized option '" +args._unknown[0]+"'");
		process.exit(1);
	}
	if (args.help) {
		help();
	}
	if (args.version) {
		version();
	}
	if (args.command) {
		await executeCommand(args.command, args.port, args.activate, args.emulator, args.timeout);
		process.exit(0);
	}
	shell(args.port, args.activate, args.emulator, args.timeout);
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
	console.log("\nSpecify no <command> to enter Shell mode.");
	process.exit(0);
}

function version() {
	console.log("amishell v" + versionLabel);
	process.exit(0);
}

async function shell(port: number, activate: boolean, emulator: string, timeout: number) {
	let rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	await prompt(rl, port);
	rl.on('line', async (command: any) => {
		await executeCommand(command, port, activate, emulator, timeout);
		await prompt(rl, port);
	});
	rl.on('close', () => {
		console.log('\n[Terminated by user]');
		terminate();
	});
}

async function prompt(rl: readline.ReadLine, port: number) {
	let cwd = await executeCommand("cd", port, false, "", 100, true);
	rl.setPrompt(cwd.replace("\n","") + "> ");
	rl.prompt();
}

async function executeCommand(command: string, port: number, activate: boolean, emulator: string, 
  timeout: number, quiet: boolean = false): Promise<string> {
	if (activate) {
		activateEmulator(emulator);
		await sleep(250);
	}
	await createSocket(port);
	return await sendCommand(command, timeout, quiet);
}

function sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    });
}

function activateEmulator(emulator: string) {
	let script = "";
	switch (platform) {
	case Platform.Mac:
	case Platform.Linux:
		script = "\"" + __dirname + "/../scripts/activate.sh" + "\" " + "fs-uae";
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
		cp.exec(script, (error, stdout, stderr) => {
			if (error) {
				console.error(error.message);
			}
		});
	}
}

var socket: net.Socket;

async function createSocket(port: number) {
	return new Promise(resolve => {
		socket = net.createConnection(port, "localhost", () => { 
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

async function sendCommand(command: string, timeout: number, quiet: boolean): Promise<string> {
	return new Promise<string>(resolve => {
		let result : string = "";
		let dataLength = 0;
		let eot : boolean = false;
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

function terminate(code: number = 0) {
	destroySocket();
	process.exit(code);
}