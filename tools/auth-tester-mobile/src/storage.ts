import type { SavedTokens } from "@ncfritz/olympus-auth-flow";
import * as SecureStore from "expo-secure-store";
import type { Target } from "./endpoints";

/**
 * SecureStore keys may hold alphanumerics, `.`, `-` and `_`, and a base URL
 * holds none of the punctuation that matters to it, so this is a mapping
 * rather than a hash: a key you can read in a debugger is worth more here than
 * one that is shorter.
 */
export const slug = (value: string): string =>
  value.replace(/[^A-Za-z0-9.\-_]+/g, "-");

export const tokensKey = (baseUrl: string): string => `tokens.${slug(baseUrl)}`;

/**
 * Written without `requireAuthentication`, beside the tokens that need it.
 *
 * `getItemAsync` resolves **null** when Face ID is declined, and null again
 * when there is nothing stored, and an app that cannot tell those apart shows
 * "not signed in" to someone who simply cancelled a prompt -- then signs them
 * in again, issuing a second session for no reason. The marker is how the two
 * are told apart; it holds no secret.
 */
export const presenceKey = (baseUrl: string): string =>
  `${tokensKey(baseUrl)}.present`;

const SETTINGS = "settings";

export type Settings = {
  target: Target;
  /** `preferEphemeralSession`: no cookie sharing, so a different user can sign in. */
  ephemeral: boolean;
  /** Face ID to read the stored tokens. Off for a simulator, which never prompts. */
  requireAuthentication: boolean;
};

export const loadSettings = async (): Promise<Settings | undefined> => {
  const stored = await SecureStore.getItemAsync(SETTINGS);
  if (stored === null) return undefined;
  try {
    return JSON.parse(stored) as Settings;
  } catch {
    // Written by an older build, or half-written. Not worth a dialogue.
    return undefined;
  }
};

export const saveSettings = (settings: Settings): Promise<void> =>
  SecureStore.setItemAsync(SETTINGS, JSON.stringify(settings));

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
