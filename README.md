# AmiShell
A shell for the [WinUAE](http://www.winuae.net/) and [FS-UAE](https://fs-uae.net/) Amiga emulators. If you are into retro crossdev, you can use this to ease the "test the created executable in the emulator" part, among other purposes.

## Installation
To install from npm:
```
npm i -g amishell
```

To install from a local package:
```
npm i -g amishell-1.0.0.tgz
```

To verify that the command is correctly installed:
```
amishell --help
```

To uninstall the package:
```
npm un -g amishell
```


## Setup
The Amiga emulator needs to be properly configured for communication through a virtual serial port.

### FS-UAE  
Include the following property in your .fs-uae configuration file:

```
serial_port = tcp://0.0.0.0:1234
```

### WinUAE
Include the following lines in your .uae configuration file:

```
win32.serial_port=TCP://0.0.0.0:1234
serial_translate=crlf_cr
serial_direct=true
```

### User-Startup
Add the following lines to your Amiga `S:User-Startup` file:

```
mount AUX:
newshell AUX:
```

You will need to have the `AUX` mountlist in the `DEVS:DosDrivers` directory.

You may want to rename the `AUX` mountlist as `AUXI` under Windows if you have any problems with that particular name.

### Serial Preferences
Execute the `Prefs:Serial` (2.0+) or `Prefs:Preferences` (1.3) program in your Amiga hard drive and set the serial preferences to these values:

* Baud Rate: 31250
* Input Buffer Size: 512
* Handshaking: XON/XOFF
* Parity: None
* Bits/Char: 8
* Stop Bits: 1

## Usage
1. Open your properly-configured Amiga emulator of choice.
2. Open a Terminal or Command Prompt window in the host machine.
3. To execute a single command (like `dir`) in the emulator and exit:
```
amishell dir
```

4. To start an interactive shell session:
```
amishell
```

5. Use Up/Down arrows for command history.
6. Use Ctrl+C to exit.

## License
MIT Licensed. Copyright (c) Xeleh 2020.

## Credits
* Coding: Jose Moreno 'Xeleh' (<jmoreno@xeleh.com>).
* Testing: Javier Romero 'Tolkien'.
