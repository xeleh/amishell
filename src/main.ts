#!/usr/bin/env node

import { AmiShell } from "./amishell";
import * as readline from "readline";

const versionLabel = "1.0";

var amishell : AmiShell;

parseArgs();

async function parseArgs() {
	let emulator = (process.platform === "win32") ? "winuae" : "fsuae";
	const optionDefinitions = [
	  { name: 'activate', alias: 'a', type: Boolean, defaultValue: false },
	  { name: 'emulator', alias: 'e', type: String, defaultValue: emulator },
	  { name: 'help', alias: 'h', type: Boolean },
	  { name: 'port', alias: 'p', type: Number, defaultValue: 1234 },
	  { name: 'timeout', alias: 't', type: Number, defaultValue: 500 },
	  { name: 'version', alias: 'v', type: Boolean },
	  { name: 'command', type: String, multiple: true, defaultOption: true }
	];
	const cliArgs = require('command-line-args');
	const args = cliArgs(optionDefinitions, { partial: true });
	if (args._unknown && args._unknown.length > 0) {
		console.log("amishell: unrecognized option '" + args._unknown[0] + "'");
		process.exit(1);
	}
	if (args.help) {
		help();
	}
	if (args.version) {
		version();
	}
	amishell = new AmiShell(args.emulator, args.port);
	amishell.on("data",	(data) => { 
		process.stdout.write(data);
	});
	amishell.on("error", (error) => {
		console.error("[Communication with Amiga emulator failed]");
		console.error(error.message);
		terminate(1);
	});
	if (args.command) {
		let command = args.command.join(" ");
		await amishell.executeCommand(command, args.activate, args.timeout);
		process.exit(0);
	}
	shell(args.activate, args.timeout);
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

async function shell(activate: boolean, timeout: number) {
	let rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	let busy = false;
	await prompt(rl);
	rl.on('line', async (command: any) => {
		if (!busy) {
			busy = true;
			await amishell.executeCommand("", false, 100, true);
			if (amishell.eot) {
				await amishell.executeCommand(command, activate, timeout);
			}
			await prompt(rl);
			busy = false;
		}
	});
	rl.on('close', () => {
		console.log('\n[Terminated by user]');
		terminate();
	});
}

async function prompt(rl: readline.ReadLine) {
	let cwd = await amishell.executeCommand("cd", false, 250, true);
	cwd = amishell.eot ? cwd.replace("\n","") + "> " : "";
	rl.setPrompt(cwd);
	rl.prompt();
}

function terminate(code: number = 0) {
	process.exit(code);
}
