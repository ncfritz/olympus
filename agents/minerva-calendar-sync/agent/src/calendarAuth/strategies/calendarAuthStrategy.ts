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
  ): { scope: string; obtainedAt: string } | undefined;

  /** Mints/refreshes an access token to confirm the stored credential still works. Throws on an invalid/expired one — check with isInvalidGrantError. */
  checkAccessToken(accountLabel: string): Promise<{ expiresAt?: string }>;

  startLoopbackFlow(request: LoopbackFlowRequest): Promise<LoopbackFlow>;

  /** True when `error` means the stored credential itself was rejected (vs. a transient failure) — surfaced as status "expired" rather than "error". */
  isInvalidGrantError(error: unknown): boolean;

  errorMessage(error: unknown): string;
}
