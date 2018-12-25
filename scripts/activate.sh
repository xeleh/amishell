#!/bin/bash

# Activates (brings window to front) the specified application.
# $1 - name of the app to activate

pgrep "$1" >/dev/null
if [ $? -eq 0 ]; then
	if [[ "$OSTYPE" == "darwin"* ]]; then
		open -a "$1" 
	elif [[ "$OSTYPE" == "linux-gnu" ]]; then
		xdotool search "$1" windowactivate
	elif [[ "$OSTYPE" == "freebsd"* ]]; then
		xdotool search "$1" windowactivate
	fi
fi
