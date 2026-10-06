import { MAIL_STAR_ICONS, type MailStarIcon } from "@ncfritz/olympus-messages";
import type { MailFlags } from "../sources/MailSourceMessage";
import type { GmailLabelInfo, GmailMailbox } from "./GmailClient";

/*
 * A message's state as Gmail gives it, in Minerva's terms (docs/plans/
 * email-management phase 1b): user labels by name, Gmail's categories by
 * lower-case name, and the system labels Minerva keeps as flags. The
 * reconcile builds it a label at a time; history polling from a message's
 * label IDs.
 */

/** Gmail's system labels Minerva keeps as flags. */
export const FLAG_LABELS: Record<string, keyof MailFlags> = {
  INBOX: "inbox",
  UNREAD: "unread",
  STARRED: "starred",
  IMPORTANT: "important",
  SENT: "sent",
};

export const CATEGORY = /^CATEGORY_([A-Z]+)$/;

/** Not mail Minerva keeps, as the import skipped them. */
export const LEFT_OUT = ["DRAFT", "CHAT"];

/** A message carrying any of these is not in Minerva. */
export const NOT_KEPT = new Set(["SPAM", "TRASH", ...LEFT_OUT]);

export const FLAG_NAMES = ["inbox", "unread", "starred", "important", "sent"];

/** A message's labels, categories and flags as Gmail has them. */
export type GmailState = {
  labels: string[];
  categories: string[];
  flags: Record<string, boolean>;
  /**
   * A starred message's icon: null when no icon's search found it,
   * undefined when the icons were not read.
   */
  starIcon?: MailStarIcon | null;
};

export const emptyFlags = (): Record<string, boolean> => ({
  inbox: false,
  unread: false,
  starred: false,
  important: false,
  sent: false,
});

export const emptyState = (): GmailState => ({
  labels: [],
  categories: [],
  flags: emptyFlags(),
});

export const toFlags = (flags: Record<string, boolean>) => ({
  inbox: flags.inbox,
  unread: flags.unread,
  starred: flags.starred,
  important: flags.important,
  sent: flags.sent,
});

/** What carrying `label` makes of a message's state. */
export const applyLabel = (state: GmailState, label: GmailLabelInfo): void => {
  const flag = FLAG_LABELS[label.id];
  if (flag) {
    state.flags[flag] = true;
    return;
  }
  const category = CATEGORY.exec(label.id);
  if (category) {
    state.categories.push(category[1].toLowerCase());
    return;
  }
  if (label.type === "user") state.labels.push(label.name);
};

/** Labels and categories in the order Minerva compares them. */
export const sortState = (state: GmailState): GmailState => {
  state.labels.sort();
  state.categories.sort();
  return state;
};

/**
 * A message's state from its label IDs, or undefined when it is not mail
 * Minerva keeps (Spam, Trash, a draft or a chat). An ID missing from
 * `labels` is a label made since they were read, and is passed over.
 */
export const stateOfLabelIds = (
  labelIds: string[],
  labels: Map<string, GmailLabelInfo>,
): GmailState | undefined => {
  if (labelIds.some((id) => NOT_KEPT.has(id))) return undefined;
  const state = emptyState();
  for (const id of labelIds) {
    const label = labels.get(id);
    if (label) applyLabel(state, label);
  }
  return sortState(state);
};

/**
 * Which starred message has which star icon. Gmail's API names only
 * STARRED; its search tells the icons apart (`has:red-bang`): one search per
 * icon, each a page or two.
 */
export const readStarIcons = async (
  mailbox: GmailMailbox,
): Promise<Map<string, MailStarIcon>> => {
  const icons = new Map<string, MailStarIcon>();
  for (const icon of MAIL_STAR_ICONS) {
    for (const id of await mailbox.messageIds(undefined, `has:${icon}`)) {
      icons.set(id, icon);
    }
  }
  return icons;
};

/** A state given its message's icon from `icons`, when it is starred. */
export const withStarIcon = (
  state: GmailState | undefined,
  id: string,
  icons: Map<string, MailStarIcon> | undefined,
): GmailState | undefined => {
  if (!state || !icons) return state;
  state.starIcon = state.flags.starred ? (icons.get(id) ?? null) : null;
  return state;
};
