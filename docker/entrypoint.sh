#!/bin/sh
set -e

CONFIG_DIR="/root/.config/mihomo"
CONFIG_FILE="${CONFIG_DIR}/config.yaml"

WARP_MODE="${WARP_MODE:-masque}"
WARP_LISTENER="${WARP_LISTENER:-socks}"
LISTENER_BIND="${LISTENER_BIND:-${SOCKS_BIND:-0.0.0.0}}"
LISTENER_PORT="${LISTENER_PORT:-${SOCKS_PORT:-1080}}"
LISTENER_USER="${LISTENER_USER:-${SOCKS_USER:-}}"
LISTENER_PASS="${LISTENER_PASS:-${SOCKS_PASS:-}}"
WARP_DNS="${WARP_DNS:-1.1.1.1,1.0.0.1}"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "config not found, starting registration..."
    echo "mode=$WARP_MODE listener=$WARP_LISTENER listen=$LISTENER_BIND:$LISTENER_PORT dns=$WARP_DNS"

    mkdir -p "$CONFIG_DIR"
    set -- llrt /app/index.js register "$WARP_MODE" -o "$CONFIG_FILE" \
        --listener "$WARP_LISTENER" --listen "$LISTENER_BIND" --port "$LISTENER_PORT" --dns "$WARP_DNS"

    if [ -n "$WARP_JWT" ]; then
        set -- "$@" --jwt "$WARP_JWT"
    fi

    if [ "$WARP_MODE" = "masque" ] && [ -n "$WARP_NAME" ]; then
        set -- "$@" --name "$WARP_NAME"
    fi

    if [ -n "$LISTENER_USER" ] && [ -n "$LISTENER_PASS" ]; then
        set -- "$@" --username "$LISTENER_USER" --password "$LISTENER_PASS"
    fi

    "$@"
    echo "registration successful: $CONFIG_FILE"
else
    echo "config exists: $CONFIG_FILE"
fi

echo "starting mihomo"
exec mihomo
