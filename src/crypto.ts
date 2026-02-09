import { randomBytes } from "node:crypto";
import { x25519 } from "@noble/curves/ed25519.js";
import { p256 } from "@noble/curves/nist.js";

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

// SEC1 DER fixed headers for P-256
// SEQUENCE(119) > INTEGER(1) > OCTET_STRING(32) > [0] OID(prime256v1) > [1] BIT_STRING(uncompressed pubkey)
const SEC1_PREFIX = new Uint8Array([0x30, 0x77, 0x02, 0x01, 0x01, 0x04, 0x20]);
const SEC1_OID = new Uint8Array([
  0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
]);
const SEC1_PUB_PREFIX = new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]);

// SPKI DER fixed header for P-256
// SEQUENCE(89) > SEQUENCE(19) > OID(ecPublicKey) > OID(prime256v1) > BIT_STRING(uncompressed pubkey)
const SPKI_PREFIX = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
  0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
  0x42, 0x00,
]);

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export function generateEcKeyPair(): EcKeyPair {
  const privateKey = p256.utils.randomSecretKey();
  const publicKey = p256.getPublicKey(privateKey, false);

  const sec1Der = concatBytes(SEC1_PREFIX, privateKey, SEC1_OID, SEC1_PUB_PREFIX, publicKey);
  const spkiDer = concatBytes(SPKI_PREFIX, publicKey);

  const privateKeyDer = Buffer.from(sec1Der);
  const publicKeyDer = Buffer.from(spkiDer);

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
