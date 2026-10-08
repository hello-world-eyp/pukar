#!/bin/zsh

# Delegate directly to start-game.command
DIR="$(dirname "$0")"
exec "$DIR/start-game.command" "$@"
