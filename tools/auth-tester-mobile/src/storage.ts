import type { SavedTokens } from "@ncfritz/olympus-auth-flow";
import * as SecureStore from "expo-secure-store";
import type { Target } from "./endpoints";
import { presenceKey, SETTINGS_KEY, tokensKey } from "./keys";

export type Settings = {
  target: Target;
  /** `preferEphemeralSession`: no cookie sharing, so a different user can sign in. */
  ephemeral: boolean;
  /** Face ID to read the stored tokens. Off for a simulator, which never prompts. */
  requireAuthentication: boolean;
};

export const loadSettings = async (): Promise<Settings | undefined> => {
  const stored = await SecureStore.getItemAsync(SETTINGS_KEY);
  if (stored === null) return undefined;
  try {
    return JSON.parse(stored) as Settings;
  } catch {
    // Written by an older build, or half-written. Not worth a dialogue.
    return undefined;
  }
};

export const saveSettings = (settings: Settings): Promise<void> =>
  SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));

export type StoredTokens =
  | { state: "none" }
  /** Present, and unreadable without authentication that did not happen. */
  | { state: "locked" }
  | { state: "signed-in"; tokens: SavedTokens };

export const loadTokens = async (
  baseUrl: string,
  options: { requireAuthentication: boolean; prompt: string },
): Promise<StoredTokens> => {
  const present = await SecureStore.getItemAsync(presenceKey(baseUrl));
  const stored = await SecureStore.getItemAsync(tokensKey(baseUrl), {
    requireAuthentication: options.requireAuthentication,
    authenticationPrompt: options.prompt,
  });
  if (stored === null) {
    return present === null ? { state: "none" } : { state: "locked" };
  }
  try {
    return { state: "signed-in", tokens: JSON.parse(stored) as SavedTokens };
  } catch {
    return { state: "none" };
  }
};

export const saveTokens = async (
  baseUrl: string,
  tokens: SavedTokens,
  options: { requireAuthentication: boolean },
): Promise<void> => {
  await SecureStore.setItemAsync(tokensKey(baseUrl), JSON.stringify(tokens), {
    requireAuthentication: options.requireAuthentication,
  });
  // After the tokens, so a marker never claims tokens that were not written.
  await SecureStore.setItemAsync(presenceKey(baseUrl), "yes");
};

export const clearTokens = async (baseUrl: string): Promise<void> => {
  // The marker first: tokens without a marker read as "none", which is the
  // safe way round to be interrupted.
  await SecureStore.deleteItemAsync(presenceKey(baseUrl));
  await SecureStore.deleteItemAsync(tokensKey(baseUrl));
};
