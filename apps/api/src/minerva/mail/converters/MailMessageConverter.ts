import {
  MAIL_STAR_ICONS,
  type MailMetadataMessage,
  type MailStarIcon,
} from "@ncfritz/olympus-messages";

/** A minerva.mail_messages row as the consumer writes it (custom names). */
export type MailMessageRow = {
  accountId: string;
  gmailId: string;
  threadId: string;
  source: string;
  snapshotTime: string;
  receivedTime: string;
  sentTime: string | null;
  fromAddress: string | null;
  fromName: string | null;
  deliveredTo: string | null;
  listId: string | null;
  hasListUnsubscribe: boolean;
  messageIdHeader: string | null;
  subject: string | null;
  snippet: string;
  sizeBytes: number;
  inInbox: boolean;
  unread: boolean;
  starred: boolean;
  starIcon: MailStarIcon | null;
  important: boolean;
  sent: boolean;
};

export type MailRecipientRow = {
  kind: "to" | "cc" | "reply_to";
  position: number;
  address: string;
  name: string | null;
};

export type MailAttachmentRow = {
  position: number;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  inline: boolean;
};

/** A label by name: a user label, or a category as a system label. */
export type MailLabelRef = { name: string; type: "user" | "system" };

export type MailMessageFields = {
  message: MailMessageRow;
  recipients: MailRecipientRow[];
  attachments: MailAttachmentRow[];
  labels: MailLabelRef[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;
const CATEGORY = /^[a-z]{1,30}$/;
const EXTENSION = /^[a-z0-9]{1,10}$/;
const MAX_INT = 2_147_483_647;

/**
 * A starred message's icon from the agent: one of Gmail's, or null for
 * none found; undefined when the message does not say.
 */
const starIconOf = (
  value: unknown,
  problems: string[],
): MailStarIcon | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!MAIL_STAR_ICONS.includes(value as MailStarIcon)) {
    problems.push(`starIcon must be one of ${MAIL_STAR_ICONS.join(", ")}`);
    return null;
  }
  return value as MailStarIcon;
};

/** Gmail's name for a category, as the API's label IDs have it. */
/**
 * The longest address a message may carry. RFC 5321 allows 320, but bulk
 * mail puts tracking tokens in Reply-To local parts past that, and Gmail
 * accepts them; the recipients table allows the same.
 */
export const MAX_MESSAGE_ADDRESS = 1024;

export const categoryLabel = (category: string): string =>
  `CATEGORY_${category.toUpperCase()}`;

/**
 * The mail agent's message as rows, or what is wrong with it. Checks every
 * field the tables would refuse, so a bad message is dead-lettered with a
 * reason rather than failing in Hasura.
 */
export const toMailMessageFields = (
  input: unknown,
): { fields: MailMessageFields } | { problems: string[] } => {
  const problems: string[] = [];
  const m = (input ?? {}) as Partial<MailMetadataMessage>;
  if (typeof input !== "object" || input === null) {
    return { problems: ["the message is not an object"] };
  }

  const text = (name: string, value: unknown, max = 10_000): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" || value.length > max) {
      problems.push(`${name} must be text of at most ${max} characters`);
      return null;
    }
    return value;
  };
  const time = (name: string, value: unknown, required: boolean) => {
    if ((value === null || value === undefined) && !required) return null;
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
      problems.push(`${name} must be an ISO-8601 time`);
      return null;
    }
    return new Date(value).toISOString();
  };
  const flag = (name: string, value: unknown): boolean => {
    if (typeof value !== "boolean")
      problems.push(`${name} must be true or false`);
    return value === true;
  };
  const size = (name: string, value: unknown): number => {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > MAX_INT
    ) {
      problems.push(`${name} must be a whole number of bytes`);
      return 0;
    }
    return value;
  };
  const address = (name: string, value: unknown) => {
    const a = value as { address?: unknown; name?: unknown } | null;
    if (
      !a ||
      typeof a.address !== "string" ||
      !a.address ||
      a.address.length > MAX_MESSAGE_ADDRESS ||
      a.address !== a.address.toLowerCase()
    ) {
      problems.push(`${name} must have a lower-case address`);
      return undefined;
    }
    return { address: a.address, name: text(`${name}.name`, a.name, 500) };
  };
  const list = <T>(name: string, value: unknown): T[] => {
    if (!Array.isArray(value)) {
      problems.push(`${name} must be a list`);
      return [];
    }
    return value as T[];
  };

  if (typeof m.accountId !== "string" || !UUID.test(m.accountId)) {
    problems.push("accountId must be a UUID");
  }
  if (m.source !== "takeout" && m.source !== "gmail") {
    problems.push("source must be takeout or gmail");
  }
  for (const key of ["gmailId", "threadId"] as const) {
    if (typeof m[key] !== "string" || !GMAIL_ID.test(m[key] as string)) {
      problems.push(`${key} must be a hexadecimal Gmail ID`);
    }
  }
  const snapshotTime = time("snapshotTime", m.snapshotTime, true);
  const receivedTime = time("receivedAt", m.receivedAt, true);
  const sentTime = time("sentAt", m.sentAt, false);
  const from =
    m.from === null || m.from === undefined
      ? undefined
      : address("from", m.from);
  if (typeof m.snippet !== "string" || Array.from(m.snippet).length > 200) {
    problems.push("snippet must be text of at most 200 characters");
  }
  const flags = (m.flags ?? {}) as Partial<MailMetadataMessage["flags"]>;
  if (typeof m.flags !== "object" || m.flags === null) {
    problems.push("flags must be an object");
  }

  const recipients: MailRecipientRow[] = [];
  for (const [field, kind] of [
    ["to", "to"],
    ["cc", "cc"],
    ["replyTo", "reply_to"],
  ] as const) {
    list<unknown>(field, m[field]).forEach((value, position) => {
      const a = address(`${field}[${position}]`, value);
      if (a) recipients.push({ kind, position, ...a });
    });
  }

  const attachments: MailAttachmentRow[] = list<Record<string, unknown>>(
    "attachments",
    m.attachments,
  ).map((a, position) => {
    const name = `attachments[${position}]`;
    const mimeType = text(`${name}.mimeType`, a?.mimeType, 255);
    if (!mimeType) problems.push(`${name}.mimeType is required`);
    const extension = text(`${name}.extension`, a?.extension, 10);
    if (extension !== null && !EXTENSION.test(extension)) {
      problems.push(`${name}.extension must be lower-case letters and digits`);
    }
    return {
      position,
      mimeType: mimeType ?? "",
      extension,
      sizeBytes: size(`${name}.sizeBytes`, a?.sizeBytes),
      inline: flag(`${name}.inline`, a?.inline),
    };
  });

  const labels: MailLabelRef[] = [];
  for (const name of list<unknown>("labels", m.labels)) {
    if (
      typeof name !== "string" ||
      !name ||
      name.length > 225 ||
      name !== name.trim()
    ) {
      problems.push("labels must be names of 1 to 225 characters");
      continue;
    }
    labels.push({ name, type: "user" });
  }
  for (const category of list<unknown>("categories", m.categories)) {
    if (typeof category !== "string" || !CATEGORY.test(category)) {
      problems.push("categories must be lower-case words");
      continue;
    }
    labels.push({ name: categoryLabel(category), type: "system" });
  }

  const message: MailMessageRow = {
    accountId: m.accountId as string,
    gmailId: m.gmailId as string,
    threadId: m.threadId as string,
    source: m.source as string,
    snapshotTime: snapshotTime as string,
    receivedTime: receivedTime as string,
    sentTime,
    fromAddress: from?.address ?? null,
    fromName: from?.name ?? null,
    deliveredTo:
      text("deliveredTo", m.deliveredTo, MAX_MESSAGE_ADDRESS)?.toLowerCase() ??
      null,
    listId: text("listId", m.listId, 500),
    hasListUnsubscribe: flag("hasListUnsubscribe", m.hasListUnsubscribe),
    messageIdHeader: text("messageIdHeader", m.messageIdHeader, 1000),
    subject: text("subject", m.subject),
    snippet: typeof m.snippet === "string" ? m.snippet : "",
    sizeBytes: size("sizeBytes", m.sizeBytes),
    inInbox: flag("flags.inbox", flags.inbox),
    unread: flag("flags.unread", flags.unread),
    starred: flag("flags.starred", flags.starred),
    // An upsert replaces the icon too: Takeout's carries none.
    starIcon:
      flags.starred === true
        ? (starIconOf(m.starIcon, problems) ?? null)
        : null,
    important: flag("flags.important", flags.important),
    sent: flag("flags.sent", flags.sent),
  };

  if (problems.length) return { problems };
  // A label named twice is one label.
  const unique = [...new Map(labels.map((l) => [l.name, l])).values()];
  return { fields: { message, recipients, attachments, labels: unique } };
};

/** A message's labels and flags only (`message.labels`), as rows. */
export type MailLabelsFields = {
  accountId: string;
  gmailId: string;
  snapshotTime: string;
  flags: Pick<
    MailMessageRow,
    "inInbox" | "unread" | "starred" | "important" | "sent"
  > & { starIcon?: MailStarIcon | null };
  labels: MailLabelRef[];
};

/** A message to forget (`message.delete`). */
export type MailDeleteFields = {
  accountId: string;
  gmailId: string;
  snapshotTime: string;
};

const keyFields = (
  m: Partial<MailMetadataMessage>,
  problems: string[],
): { accountId: string; gmailId: string; snapshotTime: string } => {
  if (typeof m.accountId !== "string" || !UUID.test(m.accountId)) {
    problems.push("accountId must be a UUID");
  }
  if (m.source !== "takeout" && m.source !== "gmail") {
    problems.push("source must be takeout or gmail");
  }
  if (typeof m.gmailId !== "string" || !GMAIL_ID.test(m.gmailId)) {
    problems.push("gmailId must be a hexadecimal Gmail ID");
  }
  const valid =
    typeof m.snapshotTime === "string" &&
    !Number.isNaN(Date.parse(m.snapshotTime));
  if (!valid) problems.push("snapshotTime must be an ISO-8601 time");
  return {
    accountId: m.accountId as string,
    gmailId: m.gmailId as string,
    snapshotTime: valid ? new Date(m.snapshotTime as string).toISOString() : "",
  };
};

/** The agent's `message.labels`, or what is wrong with it. */
export const toMailLabelsFields = (
  input: unknown,
): { fields: MailLabelsFields } | { problems: string[] } => {
  if (typeof input !== "object" || input === null) {
    return { problems: ["the message is not an object"] };
  }
  const problems: string[] = [];
  const m = input as Partial<MailMetadataMessage>;
  const key = keyFields(m, problems);
  const flags = (m.flags ?? {}) as Partial<MailMetadataMessage["flags"]>;
  if (typeof m.flags !== "object" || m.flags === null) {
    problems.push("flags must be an object");
  }
  const flag = (name: keyof MailMetadataMessage["flags"]): boolean => {
    if (typeof flags[name] !== "boolean") {
      problems.push(`flags.${name} must be true or false`);
    }
    return flags[name] === true;
  };
  const labels: MailLabelRef[] = [];
  if (!Array.isArray(m.labels)) problems.push("labels must be a list");
  for (const name of Array.isArray(m.labels) ? m.labels : []) {
    if (
      typeof name !== "string" ||
      !name ||
      name.length > 225 ||
      name !== name.trim()
    ) {
      problems.push("labels must be names of 1 to 225 characters");
      continue;
    }
    labels.push({ name, type: "user" });
  }
  if (!Array.isArray(m.categories)) problems.push("categories must be a list");
  for (const category of Array.isArray(m.categories) ? m.categories : []) {
    if (typeof category !== "string" || !CATEGORY.test(category)) {
      problems.push("categories must be lower-case words");
      continue;
    }
    labels.push({ name: categoryLabel(category), type: "system" });
  }
  const starred = flag("starred");
  const starIcon = starIconOf(m.starIcon, problems);
  const fields: MailLabelsFields = {
    ...key,
    flags: {
      inInbox: flag("inbox"),
      unread: flag("unread"),
      starred,
      important: flag("important"),
      sent: flag("sent"),
      // Unstarred has no icon; starred without one keeps what it has.
      ...(!starred
        ? { starIcon: null }
        : starIcon !== undefined
          ? { starIcon }
          : {}),
    },
    labels: [...new Map(labels.map((l) => [l.name, l])).values()],
  };
  return problems.length ? { problems } : { fields };
};

/** The agent's `message.delete`, or what is wrong with it. */
export const toMailDeleteFields = (
  input: unknown,
): { fields: MailDeleteFields } | { problems: string[] } => {
  if (typeof input !== "object" || input === null) {
    return { problems: ["the message is not an object"] };
  }
  const problems: string[] = [];
  const fields = keyFields(input as Partial<MailMetadataMessage>, problems);
  return problems.length ? { problems } : { fields };
};
