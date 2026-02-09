import yaml from "js-yaml";
import type { MasqueConfig, WgConfig } from "./config";
import { extractPemBase64, parseEndpoint, stripCidr } from "./config";

const DUMP_OPTIONS: yaml.DumpOptions = {
  lineWidth: -1,
  quotingType: '"',
  forceQuotes: false,
  schema: yaml.CORE_SCHEMA,
};

function buildBase(proxyName: string) {
  return {
    "log-level": "info",
    ipv6: true,
    "find-process-mode": "off",
    "tcp-concurrent": true,
    listeners: [
      {
        name: "socks-in-default",
        type: "socks",
        port: 1081,
        listen: "127.0.0.1",
        udp: true,
        proxy: proxyName,
      },
    ],
  };
}

// js-yaml quotes "off" to prevent YAML 1.1 boolean interpretation.
// mihomo expects unquoted `off`, so strip the quotes in post-processing.
function fixYamlQuoting(output: string): string {
  return output.replace(/find-process-mode: "off"/, "find-process-mode: off");
}

export function generateMasqueYaml(config: MasqueConfig): string {
  const proxyName = "masque";
  const { ip: server } = parseEndpoint(config.endpoint_v4);
  const publicKeyBase64 = extractPemBase64(config.endpoint_pub_key);

  const mihomoConfig = {
    ...buildBase(proxyName),
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
        dns: ["1.1.1.1", "1.0.0.1"],
      },
    ],
  };

  return fixYamlQuoting(yaml.dump(mihomoConfig, DUMP_OPTIONS));
}

export function generateWireguardYaml(config: WgConfig): string {
  const proxyName = "wireguard";
  const { ip: server, port: rawPort } = parseEndpoint(config.endpoint);
  const port = rawPort === 0 ? 2408 : rawPort;
  const ip = stripCidr(config.address);
  const ipv6 = config.address6 ? stripCidr(config.address6) : undefined;

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
  proxy.dns = [config.dns, "1.0.0.1"];

  const mihomoConfig = {
    ...buildBase(proxyName),
    proxies: [proxy],
  };

  return fixYamlQuoting(yaml.dump(mihomoConfig, DUMP_OPTIONS));
}
