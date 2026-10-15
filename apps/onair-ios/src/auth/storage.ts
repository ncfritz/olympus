import type { SavedTokens } from "@ncfritz/olympus-auth-flow";
import * as SecureStore from "expo-secure-store";

import { tokensKey } from "./keys";

/*
 * The tokens in the Keychain. No Face ID prompt: this app is opened many
 * times a day for a glance. `AFTER_FIRST_UNLOCK` rather than the default
 * `WHEN_UNLOCKED` so the widgets and Live Activity (phases 3 and 4) can
 * refresh while the phone is locked; the `_THIS_DEVICE_ONLY` variant is
 * deprecated in SDK 57.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const loadTokens = async (
  baseUrl: string,
): Promise<SavedTokens | undefined> => {
  const stored = await SecureStore.getItemAsync(tokensKey(baseUrl), OPTIONS);
  if (stored === null) return undefined;
  try {
    return JSON.parse(stored) as SavedTokens;
  } catch {
    // Half-written, or from an older build: as good as signed out.
    return undefined;
  }
};

export const saveTokens = (
  baseUrl: string,
  tokens: SavedTokens,
): Promise<void> =>
  SecureStore.setItemAsync(tokensKey(baseUrl), JSON.stringify(tokens), OPTIONS);

export const clearTokens = (baseUrl: string): Promise<void> =>
  SecureStore.deleteItemAsync(tokensKey(baseUrl), OPTIONS);
