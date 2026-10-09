/** Which existing accountLabel to (re-)authorize, or that this is a brand-new account with no label yet. */
export type LoopbackFlowRequest =
  { mode: "reauth"; accountLabel: string } | { mode: "new" };

export interface LoopbackFlow {
  authUrl: string;
  /**
   * Waits for the browser round-trip to the loopback redirect, exchanges the
   * code, and persists the resulting credential. For `mode: "new"`,
   * `accountLabel` is derived from the signed-in identity; for `mode:
   * "reauth"`, it's echoed back unchanged.
   */
  complete(timeoutMs: number): Promise<{ accountLabel: string; scope: string }>;
}

/** A sign-in the Olympus API started, at the provider (ADR 0028). */
export interface WebSignInStart {
  /** The API's callback URL, registered with the provider. */
  redirectUri: string;
  state: string;
  /** PKCE, S256. */
  codeChallenge: string;
  /** The account to sign in again, to preselect it. */
  loginHint?: string;
}

/** The provider's redirect back to the API, to redeem. */
export interface WebSignInCallback {
  /** The whole URL the provider redirected to: its code and state. */
  callbackUrl: string;
  redirectUri: string;
  /** The state the sign-in was started with: the callback must carry it. */
  state: string;
  codeVerifier: string;
  /** The account being signed in again; none for a new one. */
  accountLabel?: string;
}

/** Who signed in, and whether the agent held them before. */
export interface WebSignInResult {
  accountLabel: string;
  subject?: string;
  /** False when a credential was already stored under the label. */
  created: boolean;
}

/**
 * One provider's half of CalendarAuthService — everything that differs
 * between Google and Microsoft in how a device-flow-style credential is
 * checked, obtained, and stored. CalendarAuthService dispatches to whichever
 * strategy owns a given accountLabel; it holds no provider-specific logic
 * itself.
 */
export interface CalendarAuthStrategy {
  readonly provider: "google" | "microsoft";

  /** Every account label with a stored credential, whether or not any calendar is configured for it yet. */
  listStoredAccountLabels(): string[];

  tryLoadCredential(
    accountLabel: string,
  ): { scope: string; obtainedAt: string; subject?: string } | undefined;

  /**
   * Reads the stored account's subject from a fresh token and records it on
   * the credential, for one stored before subjects were kept. Returns the
   * subject, or undefined when the provider did not give one (the account
   * then needs a new sign-in).
   */
  recordSubject(accountLabel: string): Promise<string | undefined>;

  /** Mints/refreshes an access token to confirm the stored credential still works. Throws on an invalid/expired one — check with isInvalidGrantError. */
  checkAccessToken(accountLabel: string): Promise<{ expiresAt?: string }>;

  startLoopbackFlow(request: LoopbackFlowRequest): Promise<LoopbackFlow>;

  /** The provider's sign-in URL for a sign-in the Olympus API started. */
  startWebSignIn(start: WebSignInStart): Promise<string>;

  /**
   * Redeems the provider's redirect and stores the credential, refusing a
   * re-authorization by another account (confirmSameAccount).
   */
  completeWebSignIn(callback: WebSignInCallback): Promise<WebSignInResult>;

  /** Deletes the stored credential of `accountLabel`. */
  removeCredential(accountLabel: string): void;

  /** True when `error` means the stored credential itself was rejected (vs. a transient failure) — surfaced as status "expired" rather than "error". */
  isInvalidGrantError(error: unknown): boolean;

  errorMessage(error: unknown): string;
}
