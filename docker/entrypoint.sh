#!/bin/sh
set -e

CONFIG_DIR="/root/.config/mihomo"
CONFIG_FILE="${CONFIG_DIR}/config.yaml"

WARP_MODE="${WARP_MODE:-masque}"
SOCKS_BIND="${SOCKS_BIND:-0.0.0.0}"
SOCKS_PORT="${SOCKS_PORT:-1080}"
WARP_DNS="${WARP_DNS:-1.1.1.1,1.0.0.1}"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "config not found, starting registration..."
    echo "mode=$WARP_MODE listen=$SOCKS_BIND:$SOCKS_PORT dns=$WARP_DNS"

    mkdir -p "$CONFIG_DIR"
    set -- warp register "$WARP_MODE" -o "$CONFIG_FILE" \
        --listen "$SOCKS_BIND" --port "$SOCKS_PORT" --dns "$WARP_DNS"

    if [ -n "$WARP_JWT" ]; then
        set -- "$@" --jwt "$WARP_JWT"
    fi

    if [ "$WARP_MODE" = "masque" ] && [ -n "$WARP_NAME" ]; then
        set -- "$@" --name "$WARP_NAME"
    fi

    "$@"
    echo "registration successful: $CONFIG_FILE"
else
    echo "config exists: $CONFIG_FILE"
fi

echo "starting mihomo"
exec mihomo
