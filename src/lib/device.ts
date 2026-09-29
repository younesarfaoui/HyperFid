import "server-only";

import { createHmac, randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, isValidDeviceId } from "./device-cookie";

export { isValidDeviceId } from "./device-cookie";

function deviceSecret(): string {
  const secret = process.env.DEVICE_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("DEVICE_HASH_SECRET must be set to at least 32 characters");
  }
  return secret;
}

/** HMAC-SHA256 of the device id — the only form stored in the database. */
export function hashDevice(deviceId: string, secret: string = deviceSecret()): string {
  return createHmac("sha256", secret).update(deviceId).digest("hex");
}

/**
 * Returns this browser's device id. The proxy normally issues the cookie on
 * the scan landing GET; this only mints one as a fallback (cookie blocked or
 * cleared mid-flow). Must be called from a Server Action or Route Handler.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (isValidDeviceId(existing)) return existing;

  const deviceId = randomUUID();
  store.set(DEVICE_COOKIE, deviceId, DEVICE_COOKIE_OPTIONS);
  return deviceId;
}
