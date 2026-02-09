import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { generateEcKeyPair, generateWgKeyPair } from "./crypto";
import { register, registerWg, enrollKey } from "./api";
import type { MasqueConfig, WgConfig } from "./config";
import { parseEndpoint } from "./config";
import {
  generateMasqueYaml,
  generateWireguardYaml,
  type GeneratorOptions,
} from "./generator";

function usage(): never {
  console.log(`Usage:
  bun run src/index.ts register masque [-o output.yaml] [--jwt token] [--name device-name]
  bun run src/index.ts register wireguard [-o output.yaml] [--jwt token]

Options:
  -o, --output     output file path (default: stdout)
  --jwt            ZeroTrust JWT token
  --name           device name (masque only)
  --listen         listener bind address (default: 127.0.0.1)
  --port           listener port (default: 1080)
  --dns            comma-separated DNS servers (default: 1.1.1.1,1.0.0.1)`);
  process.exit(1);
}

async function registerMasque(
  output?: string,
  jwt?: string,
  name?: string,
  generatorOptions?: GeneratorOptions,
): Promise<void> {
  console.log("registering new MASQUE device...");
  if (jwt) {
    console.log("using ZeroTrust authentication");
  }

  // Step 1: Register with random WG key
  const account = await register("PC", "en_US", jwt);
  console.log(`account created: ${account.id}`);

  const token = account.token;
  if (!token) {
    throw new Error("no token in response");
  }

  // Step 2: Generate ECDSA key pair
  const keyPair = generateEcKeyPair();
  console.log("ECDSA key pair generated");

  // Step 3: Enroll MASQUE key
  const deviceName = name ?? "warp-ts";
  const updated = await enrollKey(
    account.id,
    token,
    keyPair.publicKeyDer,
    deviceName,
  );
  console.log("MASQUE key enrolled");

  // Step 4: Extract config from response
  const peer = updated.config.peers?.[0];
  const endpointV4 = peer?.endpoint?.v4 ?? "";
  const endpointV6 = peer?.endpoint?.v6 ?? "";
  const endpointPubKey = peer?.public_key ?? "";

  const addresses = updated.config.interface?.addresses;
  const ipv4 = addresses?.v4 ?? "";
  const ipv6 = addresses?.v6 ?? "";
  const license = updated.account.license ?? "";

  if (!endpointV4 && !endpointV6) {
    throw new Error("no endpoint info in response");
  }
  if (!endpointPubKey) {
    throw new Error("no endpoint public key in response");
  }
  if (!ipv4 && !ipv6) {
    throw new Error("no interface addresses in response");
  }

  const masqueConfig: MasqueConfig = {
    private_key: keyPair.privateKeyBase64,
    endpoint_v4: endpointV4,
    endpoint_v6: endpointV6,
    endpoint_pub_key: endpointPubKey,
    license,
    id: updated.id,
    access_token: token,
    ipv4,
    ipv6,
  };

  // Step 5: Generate mihomo YAML
  const yamlOutput = generateMasqueYaml(masqueConfig, generatorOptions);

  if (output) {
    writeFileSync(output, yamlOutput);
    console.log(`config saved to ${output}`);
  } else {
    console.log("\n" + yamlOutput);
  }

  console.log("registration successful");
}

async function registerWireguard(
  output?: string,
  jwt?: string,
  generatorOptions?: GeneratorOptions,
): Promise<void> {
  console.log("registering new WireGuard device...");
  if (jwt) {
    console.log("using ZeroTrust authentication");
  }

  // Step 1: Generate Curve25519 key pair
  const wgKeys = generateWgKeyPair();
  console.log("WireGuard key pair generated");

  // Step 2: Register with real WG public key
  const account = await registerWg(
    wgKeys.publicKeyBase64,
    "PC",
    "en_US",
    jwt,
  );
  console.log(`account created: ${account.id}`);

  const token = account.token;
  if (!token) {
    throw new Error("no token in response");
  }

  // Step 3: Extract peer config
  const peer = account.config.peers?.[0];
  if (!peer) {
    throw new Error("no peer info in response");
  }

  const peerPublicKey = peer.public_key;
  const endpointV4 = peer.endpoint?.v4 ?? "";
  const endpointV6 = peer.endpoint?.v6;

  const addresses = account.config.interface?.addresses;
  if (!addresses) {
    throw new Error("no interface addresses in response");
  }

  const ipv4 = addresses.v4 ?? "";
  const ipv6 = addresses.v6;
  const clientId = account.config.client_id ?? "";

  if (!endpointV4) {
    throw new Error("no endpoint v4 in response");
  }
  if (!ipv4) {
    throw new Error("no IPv4 address in response");
  }

  // Step 4: Build endpoint string (port 0 -> 2408)
  const { ip: endpointIp, port: rawPort } = parseEndpoint(endpointV4);
  const endpointPort = rawPort === 0 ? 2408 : rawPort;
  const endpointStr = `${endpointIp}:${endpointPort}`;

  let endpoint6Str: string | undefined;
  if (endpointV6) {
    const trimmed = endpointV6.replace(/^\[|\]$/g, "");
    const { ip: ip6, port: port6 } = parseEndpoint(
      trimmed.includes("]:") ? endpointV6 : `[${trimmed}]:0`,
    );
    const ep6Port = port6 === 0 ? 2408 : port6;
    endpoint6Str = `[${ip6}]:${ep6Port}`;
  }

  // Step 5: Build WgConfig
  const wgConfig: WgConfig = {
    deviceId: account.id,
    privateKey: wgKeys.privateKeyBase64,
    token,
    clientId,
    accountType: "free",
    mtu: 1280,
    peerPublicKey,
    endpoint: endpointStr,
    endpoint6: endpoint6Str,
    keepalive: 30,
    address: `${ipv4}/32`,
    address6: ipv6 ? `${ipv6}/128` : undefined,
    dns: "1.1.1.1",
  };

  // Step 6: Generate mihomo YAML
  const yamlOutput = generateWireguardYaml(wgConfig, generatorOptions);

  if (output) {
    writeFileSync(output, yamlOutput);
    console.log(`config saved to ${output}`);
  } else {
    console.log("\n" + yamlOutput);
  }

  console.log("registration successful");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2 || args[0] !== "register") {
    usage();
  }

  const mode = args[1];
  if (mode !== "masque" && mode !== "wireguard") {
    usage();
  }

  const { values } = parseArgs({
    args: args.slice(2),
    options: {
      output: { type: "string", short: "o" },
      jwt: { type: "string" },
      name: { type: "string" },
      listen: { type: "string" },
      port: { type: "string" },
      dns: { type: "string" },
    },
    strict: false,
  });

  const output = values.output as string | undefined;
  const jwt = values.jwt as string | undefined;
  const name = values.name as string | undefined;

  const generatorOptions: GeneratorOptions = {};
  if (values.listen) {
    generatorOptions.listen = values.listen as string;
  }
  if (values.port) {
    generatorOptions.port = parseInt(values.port as string, 10);
  }
  if (values.dns) {
    generatorOptions.dns = (values.dns as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (mode === "masque") {
    await registerMasque(output, jwt, name, generatorOptions);
  } else {
    await registerWireguard(output, jwt, generatorOptions);
  }
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(1);
});
