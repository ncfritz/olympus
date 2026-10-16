import * as SecureStore from "expo-secure-store";

import { parseSettings, type WorkSettings } from "./settings";

/*
 * The working-day settings, kept on the phone. In the Keychain beside the
 * tokens, since expo-secure-store is already in the build and they are a
 * few bytes; nothing here is secret.
 */
const KEY = "onair.settings";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const loadSettings = async (): Promise<WorkSettings> => {
  try {
    return parseSettings(await SecureStore.getItemAsync(KEY, OPTIONS));
  } catch {
    return parseSettings(null);
  }
};

export const saveSettings = (settings: WorkSettings): Promise<void> =>
  SecureStore.setItemAsync(KEY, JSON.stringify(settings), OPTIONS);
