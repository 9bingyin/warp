import yaml from "js-yaml";
import type { MasqueConfig, WgConfig } from "./config";
import { extractPemBase64, parseEndpoint, stripCidr } from "./config";

const DUMP_OPTIONS: yaml.DumpOptions = {
  lineWidth: -1,
  quotingType: '"',
  forceQuotes: false,
  schema: yaml.CORE_SCHEMA,
};

const DEFAULT_DNS = ["1.1.1.1", "1.0.0.1"];

export interface GeneratorOptions {
  listenerType?: "socks" | "http" | "mixed";
  listen?: string;
  port?: number;
  dns?: string[];
  username?: string;
  password?: string;
}

function buildBase(
  proxyName: string,
  listenerType: "socks" | "http" | "mixed" = "socks",
  listen = "127.0.0.1",
  port = 1080,
  username?: string,
  password?: string,
) {
  const listener: Record<string, unknown> = {
    name: `${listenerType}-in-default`,
    type: listenerType,
    port,
    listen,
    proxy: proxyName,
  };

  if (listenerType !== "http") {
    listener.udp = true;
  }

  if (username && password) {
    listener.users = [{ username, password }];
  }

  return {
    "log-level": "info",
    ipv6: true,
    "find-process-mode": "off",
    "tcp-concurrent": true,
    listeners: [listener],
  };
}

// js-yaml quotes "off" to prevent YAML 1.1 boolean interpretation.
// mihomo expects unquoted `off`, so strip the quotes in post-processing.
function fixYamlQuoting(output: string): string {
  return output.replace(/find-process-mode: "off"/, "find-process-mode: off");
}

export function generateMasqueYaml(
  config: MasqueConfig,
  options?: GeneratorOptions,
): string {
  const proxyName = "masque";
  const { ip: server } = parseEndpoint(config.endpoint_v4);
  const publicKeyBase64 = extractPemBase64(config.endpoint_pub_key);
  const dns = options?.dns ?? DEFAULT_DNS;

  const mihomoConfig = {
    ...buildBase(
      proxyName,
      options?.listenerType,
      options?.listen,
      options?.port,
      options?.username,
      options?.password,
    ),
    proxies: [
      {
        name: proxyName,
        type: "masque",
        server,
        port: 443,
        "private-key": config.private_key,
        "public-key": publicKeyBase64,
        ip: config.ipv4,
        ipv6: config.ipv6,
        udp: true,
        "remote-dns-resolve": true,
        dns,
      },
    ],
  };

  return fixYamlQuoting(yaml.dump(mihomoConfig, DUMP_OPTIONS));
}

export function generateWireguardYaml(
  config: WgConfig,
  options?: GeneratorOptions,
): string {
  const proxyName = "wireguard";
  const { ip: server, port: rawPort } = parseEndpoint(config.endpoint);
  const port = rawPort === 0 ? 2408 : rawPort;
  const ip = stripCidr(config.address);
  const ipv6 = config.address6 ? stripCidr(config.address6) : undefined;
  const dns = options?.dns ?? DEFAULT_DNS;

  let reserved: number[] | undefined;
  if (config.clientId) {
    const decoded = Buffer.from(config.clientId, "base64");
    if (decoded.length >= 3) {
      reserved = [decoded[0]!, decoded[1]!, decoded[2]!];
    }
  }

  const proxy: Record<string, unknown> = {
    name: proxyName,
    type: "wireguard",
    server,
    port,
    "private-key": config.privateKey,
    "public-key": config.peerPublicKey,
    ip,
  };
  if (ipv6) {
    proxy.ipv6 = ipv6;
  }
  if (reserved) {
    proxy.reserved = reserved;
  }
  proxy.udp = true;
  proxy.mtu = config.mtu;
  proxy["remote-dns-resolve"] = true;
  proxy.dns = dns;

  const mihomoConfig = {
    ...buildBase(
      proxyName,
      options?.listenerType,
      options?.listen,
      options?.port,
      options?.username,
      options?.password,
    ),
    proxies: [proxy],
  };

  return fixYamlQuoting(yaml.dump(mihomoConfig, DUMP_OPTIONS));
}
