import { generateRandomWgPubkey, generateRandomSerial } from "./crypto";

const API_URL = "https://api.cloudflareclient.com";
const API_VERSION = "v0a4471";
const KEY_TYPE_WG = "curve25519";
const TUN_TYPE_WG = "wireguard";
const KEY_TYPE_MASQUE = "secp256r1";
const TUN_TYPE_MASQUE = "masque";
const REQUEST_TIMEOUT_MS = 30_000;

interface Registration {
  key: string;
  install_id: string;
  fcm_token: string;
  tos: string;
  model: string;
  serial_number: string;
  os_version: string;
  key_type: string;
  tunnel_type: string;
  locale: string;
}

interface DeviceUpdate {
  key: string;
  key_type: string;
  tunnel_type: string;
  name?: string;
}

export interface Endpoint {
  v4?: string;
  v6?: string;
}

export interface Peer {
  public_key: string;
  endpoint?: Endpoint;
}

export interface Addresses {
  v4?: string;
  v6?: string;
}

export interface InterfaceConfig {
  addresses?: Addresses;
}

export interface AccountConfig {
  peers?: Peer[];
  interface?: InterfaceConfig;
  client_id?: string;
}

export interface Account {
  license?: string;
}

export interface AccountData {
  id: string;
  account: Account;
  config: AccountConfig;
  token?: string;
}

function defaultHeaders(): Record<string, string> {
  return {
    "User-Agent": "WARP for Android",
    "CF-Client-Version": "a-6.35-4471",
    "Content-Type": "application/json; charset=UTF-8",
    Connection: "Keep-Alive",
  };
}

function formatTimestamp(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0") +
    "T" +
    String(now.getHours()).padStart(2, "0") +
    ":" +
    String(now.getMinutes()).padStart(2, "0") +
    ":" +
    String(now.getSeconds()).padStart(2, "0") +
    "." +
    ms +
    sign +
    hours +
    ":" +
    minutes
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function register(
  model: string,
  locale: string,
  jwt?: string,
): Promise<AccountData> {
  const wgKey = generateRandomWgPubkey();
  const serial = generateRandomSerial();

  const registration: Registration = {
    key: wgKey,
    install_id: "",
    fcm_token: "",
    tos: formatTimestamp(),
    model,
    serial_number: serial,
    os_version: "",
    key_type: KEY_TYPE_WG,
    tunnel_type: TUN_TYPE_WG,
    locale,
  };

  const url = `${API_URL}/${API_VERSION}/reg`;
  const headers: Record<string, string> = { ...defaultHeaders() };
  if (jwt) {
    headers["CF-Access-Jwt-Assertion"] = jwt;
  }

  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: JSON.stringify(registration),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`registration failed: ${resp.status} - ${body}`);
  }

  return (await resp.json()) as AccountData;
}

export async function registerWg(
  wgPublicKey: string,
  model: string,
  locale: string,
  jwt?: string,
): Promise<AccountData> {
  const serial = generateRandomSerial();

  const registration: Registration = {
    key: wgPublicKey,
    install_id: "",
    fcm_token: "",
    tos: formatTimestamp(),
    model,
    serial_number: serial,
    os_version: "",
    key_type: KEY_TYPE_WG,
    tunnel_type: TUN_TYPE_WG,
    locale,
  };

  const url = `${API_URL}/${API_VERSION}/reg`;
  const headers: Record<string, string> = { ...defaultHeaders() };
  if (jwt) {
    headers["CF-Access-Jwt-Assertion"] = jwt;
  }

  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: JSON.stringify(registration),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`WG registration failed: ${resp.status} - ${body}`);
  }

  return (await resp.json()) as AccountData;
}

export async function enrollKey(
  accountId: string,
  accessToken: string,
  pubKeyDer: Buffer,
  name?: string,
): Promise<AccountData> {
  const deviceUpdate: DeviceUpdate = {
    key: pubKeyDer.toString("base64"),
    key_type: KEY_TYPE_MASQUE,
    tunnel_type: TUN_TYPE_MASQUE,
  };
  if (name) {
    deviceUpdate.name = name;
  }

  const url = `${API_URL}/${API_VERSION}/reg/${accountId}`;
  const resp = await fetchWithTimeout(url, {
    method: "PATCH",
    headers: {
      ...defaultHeaders(),
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(deviceUpdate),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`enroll key failed: ${resp.status} - ${body}`);
  }

  return (await resp.json()) as AccountData;
}
