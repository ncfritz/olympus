/*
 * The management API's shapes (the API is its only caller, ADR 0028):
 * linking a mailbox to Gmail by the API's consent flow, and the mailboxes
 * linked. Tokens never appear in any of them.
 */

export class StartGmailSignInRequest {
  /** The API's callback, registered with Google. */
  redirectUri: string;
  /** The API's state, which it checks on the callback. */
  state: string;
  /** S256 of the API's PKCE verifier. */
  codeChallenge: string;
  /** The mailbox being linked: Google's login hint, and checked after. */
  email: string;
}

export class StartGmailSignInResponse {
  authUrl: string;
}

export class CompleteGmailSignInRequest {
  /** The callback as Google sent it, query and all. */
  callbackUrl: string;
  redirectUri: string;
  state: string;
  codeVerifier: string;
  /** The mailbox the sign-in was started for. */
  email: string;
}

export class GmailSignInResult {
  email: string;
  subject: string;
  scope: string;
  /** Whether the mailbox was not linked before. */
  created: boolean;
}

export class CompleteGmailSignInResponse {
  account: GmailSignInResult;
}

export class GmailAccount {
  email: string;
  subject: string;
  scope: string;
  obtainedTime: string;
}

export class ListGmailAccountsResponse {
  accounts: GmailAccount[];
}

/** A label to write, by name and Gmail's ID. */
export class GmailWriteLabel {
  name: string;
  gmailLabelId: string;
}

/** One message's label change. */
export class GmailWriteChange {
  gmailId: string;
  /**
   * The user labels, by name, the message must still have in Gmail for the
   * change to be written; otherwise it was changed there since.
   */
  expected: string[];
  add: GmailWriteLabel[];
  remove: GmailWriteLabel[];
}

/** A batch of label changes the API recorded, to write to Gmail. */
export class StartGmailWritesRequest {
  batchId: string;
  /** The Olympus mail account, which Minerva's updates are published for. */
  accountId: string;
  /** The mailbox, linked with gmail.modify. */
  email: string;
  changes: GmailWriteChange[];
}

export class StartGmailWritesResponse {
  /** Changes taken, to be written in the background. */
  accepted: number;
}
