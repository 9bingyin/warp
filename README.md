# warp

Cloudflare WARP 设备注册 + mihomo 配置生成器。支持 MASQUE 和 WireGuard 两种隧道模式。

## Docker

容器启动时自动注册 WARP 设备并生成 mihomo 配置，随后启动 mihomo 代理。

```bash
docker run -d \
  --name warp \
  --restart unless-stopped \
  -p 1080:1080 \
  ghcr.io/9bingyin/warp:latest
```

### 持久化配置

将配置目录挂载到宿主机，避免容器重建时重复注册：

```bash
docker run -d \
  --name warp \
  --restart unless-stopped \
  -p 1080:1080 \
  -v ./config:/root/.config/mihomo \
  ghcr.io/9bingyin/warp:latest
```

### Docker Compose

```yaml
services:
  warp:
    image: ghcr.io/9bingyin/warp:latest
    container_name: warp
    restart: unless-stopped
    ports:
      - "1080:1080"
    volumes:
      - ./config:/root/.config/mihomo
    environment:
      - WARP_MODE=masque
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WARP_MODE` | 隧道模式：`masque` 或 `wireguard` | `masque` |
| `WARP_JWT` | Cloudflare Zero Trust JWT token | - |
| `WARP_NAME` | 设备名称（仅 masque 模式） | - |
| `WARP_DNS` | 自定义 DNS，逗号分隔 | `1.1.1.1,1.0.0.1` |
| `SOCKS_BIND` | SOCKS5 监听地址 | `0.0.0.0` |
| `SOCKS_PORT` | SOCKS5 监听端口 | `1080` |

## CLI

需要 [Bun](https://bun.sh) 运行时。

```bash
bun install
```

### 注册并生成配置

```bash
# MASQUE 模式
bun run src/index.ts register masque -o config.yaml

# WireGuard 模式
bun run src/index.ts register wireguard -o config.yaml

# 自定义参数
bun run src/index.ts register masque -o config.yaml \
  --listen 0.0.0.0 --port 7891 --dns 8.8.8.8,8.8.4.4
```

### CLI 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output` | 输出文件路径（不指定则输出到 stdout） | - |
| `--jwt` | Cloudflare Zero Trust JWT token | - |
| `--name` | 设备名称（仅 masque 模式） | - |
| `--listen` | 监听地址 | `127.0.0.1` |
| `--port` | 监听端口 | `1080` |
| `--dns` | 自定义 DNS，逗号分隔 | `1.1.1.1,1.0.0.1` |
