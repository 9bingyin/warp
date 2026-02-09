import { generateKeyPairSync, randomBytes } from "node:crypto";
import { x25519 } from "@noble/curves/ed25519.js";

export interface EcKeyPair {
  privateKeyDer: Buffer;
  publicKeyDer: Buffer;
  privateKeyBase64: string;
  publicKeyBase64: string;
}

export interface WgKeyPair {
  privateKey: Uint8Array;
  publicKeyBase64: string;
  privateKeyBase64: string;
}

export function generateEcKeyPair(): EcKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });

  const privateKeyDer = privateKey.export({ type: "sec1", format: "der" });
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });

  return {
    privateKeyDer,
    publicKeyDer,
    privateKeyBase64: privateKeyDer.toString("base64"),
    publicKeyBase64: publicKeyDer.toString("base64"),
  };
}

export function generateWgKeyPair(): WgKeyPair {
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);

  return {
    privateKey,
    publicKeyBase64: Buffer.from(publicKey).toString("base64"),
    privateKeyBase64: Buffer.from(privateKey).toString("base64"),
  };
}

export function generateRandomWgPubkey(): string {
  const bytes = randomBytes(32);
  return bytes.toString("base64");
}

export function generateRandomSerial(): string {
  const bytes = randomBytes(8);
  return bytes.toString("hex");
}
