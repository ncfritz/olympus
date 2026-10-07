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

/**
 * A label to write, by name and Gmail's ID; without an ID, a label the
 * batch creates first, found by name once made.
 */
export class GmailWriteLabel {
  name: string;
  gmailLabelId?: string;
}

/** A label to create, rename or delete. */
export class GmailWriteLabelOp {
  op: "create" | "rename" | "delete";
  /** The label as it is named before the batch runs. */
  name: string;
  /** A rename's new name. */
  newName?: string;
  /** Gmail's ID, for a label that exists. */
  gmailLabelId?: string;
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
  /**
   * Labels to create, rename and delete: creates and renames before the
   * messages are written, deletes after, and only once Gmail says empty.
   */
  labelOps?: GmailWriteLabelOp[];
}

export class StartGmailWritesResponse {
  /** Changes taken, to be written in the background. */
  accepted: number;
}

/** A sender or recipient as a message's headers name them. */
export class GmailMessageAddress {
  address: string;
  name?: string;
}

/** An attachment's description; its content is never sent. */
export class GmailMessageAttachment {
  filename?: string;
  mimeType: string;
  sizeBytes: number;
  /** Shown in the body (an inline image) rather than attached. */
  inline: boolean;
}

/**
 * A message read live from Gmail to be shown once (docs/plans/
 * email-management phase 5): held for the request, stored and logged
 * nowhere.
 */
export class GmailMessageContent {
  gmailId: string;
  threadId: string;
  labelIds: string[];
  subject?: string;
  from?: GmailMessageAddress;
  replyTo: GmailMessageAddress[];
  to: GmailMessageAddress[];
  cc: GmailMessageAddress[];
  /** The Date header, ISO 8601. */
  sentTime?: string;
  /** Gmail's received time, ISO 8601. */
  receivedTime: string;
  /** The plain text body, or the HTML's text when there is none. */
  text: string;
  /** The HTML body as sent, unsanitized: the caller must contain it. */
  html?: string;
  /** Whether text or html was cut at the size limit. */
  truncated: boolean;
  attachments: GmailMessageAttachment[];
}
