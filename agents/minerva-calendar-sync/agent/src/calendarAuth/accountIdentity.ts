import { AccountMismatchError } from "./AccountMismatchError";

/**
 * Who actually signed in at the provider's consent screen: the account's
 * subject (its permanent ID there, ADR 0028: Google's `sub`, Microsoft's
 * `<tid>:<oid>`) and its verified email, when the provider gave them.
 */
export interface AccountIdentity {
  subject?: string;
  email?: string;
}

/**
 * Refuses a re-authorization of `accountLabel` unless the account that
 * signed in is the same one: by subject when one is stored for it, else by
 * its verified email, which is what the label was taken from. Without this
 * a different account picked at the consent screen would be saved under
 * the old label, and its calendars synced as the old account's.
 *
 * @throws AccountMismatchError
 */
export function confirmSameAccount(
  accountLabel: string,
  storedSubject: string | undefined,
  signedIn: AccountIdentity,
): void {
  if (storedSubject !== undefined) {
    if (signedIn.subject === storedSubject) return;
    throw new AccountMismatchError(
      `Signed in as a different account than "${accountLabel}"; nothing was changed`,
    );
  }
  if (signedIn.email === undefined) {
    throw new AccountMismatchError(
      `Could not confirm that the account signed in is "${accountLabel}"; nothing was changed`,
    );
  }
  if (signedIn.email.toLowerCase() !== accountLabel.toLowerCase()) {
    throw new AccountMismatchError(
      `Signed in as ${signedIn.email}, not "${accountLabel}"; nothing was changed`,
    );
  }
}
