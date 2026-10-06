/**
 * A sign-in that came back as another Google account than the mailbox
 * being linked: another address, or the same address with another subject
 * (ADR 0028: re-authorization must return the stored subject). Nothing is
 * saved.
 */
export class GmailAccountMismatchError extends Error {
  constructor(readonly reason: "email" | "subject") {
    super(
      reason === "email"
        ? "The sign-in was for another mailbox"
        : "The sign-in was for another Google account with this address",
    );
  }
}
