import * as cp from "child_process";
import * as net from "net";
import { EventEmitter } from "events";

export class AmiShell extends EventEmitter {

private emulator: string;
private port: number;
private scripts: string;

constructor(emulator: string, port: number, scripts: string = null) {
	super();
	this.emulator = emulator;
	this.port = port;
	if (scripts == null) {
		scripts = __dirname + "/../scripts";
	}
	this.scripts = scripts;
}

public async executeCommand(command: string, activate: boolean, timeout: number, 
  quiet: boolean = false): Promise<string> {
	if (activate) {
		this.activateEmulator();
		await this.sleep(250);
	}
	await this.createSocket();
	return await this.sendCommand(command, timeout, quiet);
}

private sleep(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

private activateEmulator() {
	let command = "";
	switch (process.platform) {
	case "darwin":
	case "linux":
		command = "\"" + this.scripts + "/activate.sh" + "\" " + "fs-uae";
		break;
	case "win32":
		let winPath = this.scripts.replace("/", "\\");
		command = "cscript //nologo \"" + winPath + "\\activate.vbs" + "\" ";
		switch (this.emulator) {
		case "fsuae":
			command += "fs-uae.exe";
			break;
		case "winuae":
			command += "winuae.exe winuae64.exe";
			break;
		}
		break;
	}
	if (command != "") {
		cp.exec(command, (error, stdout, stderr) => {
			if (error) {
				this.destroySocket();
				this.emit("error", error);
			}
		});
	}
}

private socket: net.Socket;

private async createSocket() {
	return new Promise(resolve => {
		this.socket = net.createConnection(this.port, "localhost", () => { 
			this.socket.setEncoding("ascii");
			resolve();
		});
		this.socket.on("error", (error) => {
			this.destroySocket();
			this.emit("error", error);
		});
	});
}

public eot : boolean = false;

private async sendCommand(command: string, timeout: number, quiet: boolean): Promise<string> {
	return new Promise<string>(resolve => {
		let result : string = "";
		let dataLength = 0;
		this.eot = false;
		let prompt = "";
		this.socket.on("data", (data) => {
			var response = data.toString();
			// AmigaDos sends ascii char SI (15) as EOT signal
			if (response.charCodeAt(0) == 15) {
				this.eot = true;
			}
			if (!this.eot) {
				response = response.replace("\r", "");
				// filter the command itself
				if (dataLength > command.length) {
					if (!quiet) {
						this.emit("data", response);
					}
					result += response;
				}
				dataLength += response.length;
			} else {
				// wait for complete prompt
				prompt += response;
				if (prompt.lastIndexOf("> ") >= 0) {
					this.socket.setTimeout(10);
				}
			}
		});
		// the promise will be resolved on timeout
		this.socket.setTimeout(timeout);
		this.socket.on("timeout", () => {
			this.destroySocket();
			resolve(result);
		});
		// send the command
		this.socket.write(command + "\r");
	});
}

private destroySocket() {
	if (this.socket && !this.socket.destroyed) {
		this.socket.end();
		this.socket.destroy();
	}
}

}
