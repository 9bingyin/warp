export interface MasqueConfig {
  private_key: string;
  endpoint_v4: string;
  endpoint_v6: string;
  endpoint_pub_key: string;
  license: string;
  id: string;
  access_token: string;
  ipv4: string;
  ipv6: string;
}

export interface WgConfig {
  deviceId: string;
  privateKey: string;
  token: string;
  clientId: string;
  accountType: string;
  mtu: number;
  peerPublicKey: string;
  endpoint: string;
  endpoint6?: string;
  keepalive: number;
  address: string;
  address6?: string;
  dns: string;
}

export function serializeWgIni(config: WgConfig): string {
  const lines: string[] = [];

  lines.push("[Device]");
  lines.push(`MTU=${config.mtu}`);

  lines.push("[Account]");
  lines.push(`PrivateKey=${config.privateKey}`);
  lines.push(`Token=${config.token}`);
  lines.push(`Device=${config.deviceId}`);
  lines.push(`ClientId=${config.clientId}`);
  lines.push(`Type=${config.accountType}`);

  lines.push("[Interface]");
  lines.push(`Address=${config.address}`);
  lines.push(`DNS=${config.dns}`);
  if (config.address6) {
    lines.push(`Address6=${config.address6}`);
  }

  lines.push("[Peer]");
  lines.push(`PublicKey=${config.peerPublicKey}`);
  lines.push(`Endpoint=${config.endpoint}`);
  if (config.endpoint6) {
    lines.push(`Endpoint6=${config.endpoint6}`);
  }
  lines.push(`KeepAlive=${config.keepalive}`);

  return lines.join("\n") + "\n";
}

export function extractPemBase64(pem: string): string {
  return pem
    .split("\n")
    .filter((line) => !line.startsWith("-----"))
    .join("");
}

export function parseEndpoint(endpoint: string): { ip: string; port: number } {
  if (endpoint.startsWith("[")) {
    const closeBracket = endpoint.indexOf("]");
    const ip = endpoint.slice(1, closeBracket);
    const portStr = endpoint.slice(closeBracket + 2);
    return { ip, port: parseInt(portStr, 10) || 0 };
  }
  const lastColon = endpoint.lastIndexOf(":");
  return {
    ip: endpoint.slice(0, lastColon),
    port: parseInt(endpoint.slice(lastColon + 1), 10) || 0,
  };
}

export function stripCidr(address: string): string {
  return address.split("/")[0] ?? address;
}
