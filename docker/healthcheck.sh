#!/bin/sh

LISTENER_TYPE="${WARP_LISTENER:-socks}"
BIND="${LISTENER_BIND:-${SOCKS_BIND:-0.0.0.0}}"
PORT="${LISTENER_PORT:-${SOCKS_PORT:-1080}}"
USER_NAME="${LISTENER_USER:-${SOCKS_USER:-}}"
PASSWORD="${LISTENER_PASS:-${SOCKS_PASS:-}}"

if [ "$BIND" = "0.0.0.0" ]; then
    TEST_HOST="127.0.0.1"
else
    TEST_HOST="$BIND"
fi

PROXY="${TEST_HOST}:${PORT}"

AUTH_ARGS=""
if [ -n "$USER_NAME" ] && [ -n "$PASSWORD" ]; then
    AUTH_ARGS="--proxy-user ${USER_NAME}:${PASSWORD}"
fi

check_url() {
    if [ "$LISTENER_TYPE" = "http" ]; then
        curl --silent --fail \
            --connect-timeout 5 \
            --max-time 10 \
            --proxy "http://${PROXY}" \
            $AUTH_ARGS \
            "$1" \
            -o /dev/null \
            -w "%{http_code}" 2>/dev/null
    else
        curl --silent --fail \
            --connect-timeout 5 \
            --max-time 10 \
            --socks5-hostname "$PROXY" \
            $AUTH_ARGS \
            "$1" \
            -o /dev/null \
            -w "%{http_code}" 2>/dev/null
    fi
}

status=$(check_url "http://connectivitycheck.gstatic.com/generate_204")
if [ "$status" = "204" ]; then
    exit 0
fi

status=$(check_url "http://cp.cloudflare.com/")
if [ "$status" = "204" ]; then
    exit 0
fi

status=$(check_url "https://cloudflare.com/cdn-cgi/trace")
if [ "$status" = "200" ]; then
    exit 0
fi

echo "healthcheck failed"
exit 1
