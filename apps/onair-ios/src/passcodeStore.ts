import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { CLEAR_RECORD, type LockRecord, parseRecord } from "./lockRules";

/*
 * OnAir's passcode in the Keychain, salted and hashed: the digits are never
 * stored. The lock record (wrong tries, the wait) sits beside it.
 */
const PASSCODE_KEY = "onair.passcode";
const RECORD_KEY = "onair.lock";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

type Stored = { salt: string; hash: string };

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hashOf = (salt: string, code: string): Promise<string> =>
  Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${code}`,
  );

const readStored = async (): Promise<Stored | undefined> => {
  const raw = await SecureStore.getItemAsync(PASSCODE_KEY, OPTIONS);
  if (raw === null) return undefined;
  try {
    const value = JSON.parse(raw) as Partial<Stored>;
    return typeof value.salt === "string" && typeof value.hash === "string"
      ? { salt: value.salt, hash: value.hash }
      : undefined;
  } catch {
    return undefined;
  }
};

export const hasPasscode = async (): Promise<boolean> =>
  (await readStored()) !== undefined;

export const savePasscode = async (code: string): Promise<void> => {
  const salt = hex(Crypto.getRandomBytes(16));
  const stored: Stored = { salt, hash: await hashOf(salt, code) };
  await SecureStore.setItemAsync(PASSCODE_KEY, JSON.stringify(stored), OPTIONS);
  await saveRecord(CLEAR_RECORD);
};

export const removePasscode = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(PASSCODE_KEY, OPTIONS);
  await SecureStore.deleteItemAsync(RECORD_KEY, OPTIONS);
};

export const passcodeMatches = async (code: string): Promise<boolean> => {
  const stored = await readStored();
  return (
    stored !== undefined && (await hashOf(stored.salt, code)) === stored.hash
  );
};

export const loadRecord = async (): Promise<LockRecord> =>
  parseRecord(await SecureStore.getItemAsync(RECORD_KEY, OPTIONS));

export const saveRecord = (record: LockRecord): Promise<void> =>
  SecureStore.setItemAsync(RECORD_KEY, JSON.stringify(record), OPTIONS);
