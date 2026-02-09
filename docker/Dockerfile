FROM oven/bun:alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src/ ./src/
COPY tsconfig.json ./

RUN bun build src/index.ts --outfile dist/index.js --target=bun

# ---

FROM alpine:latest AS mihomo-downloader

ARG TARGETARCH
ARG MIHOMO_VERSION

WORKDIR /tmp

RUN apk --no-cache add wget

RUN DOWNLOAD_URL="https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/mihomo-linux-${TARGETARCH}-${MIHOMO_VERSION}.gz" && \
    echo "downloading: ${DOWNLOAD_URL}" && \
    wget -O mihomo.gz "${DOWNLOAD_URL}" && \
    gunzip mihomo.gz && \
    chmod +x mihomo

# ---

FROM oven/bun:alpine

RUN apk --no-cache add ca-certificates curl

COPY --from=mihomo-downloader /tmp/mihomo /usr/local/bin/mihomo
COPY --from=builder /app/dist/index.js /app/index.js

COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/healthcheck.sh /healthcheck.sh
RUN chmod +x /entrypoint.sh /healthcheck.sh

EXPOSE 1080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD ["/healthcheck.sh"]

ENTRYPOINT ["/entrypoint.sh"]
