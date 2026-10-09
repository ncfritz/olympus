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

/**
 * Gmail's system labels a batch may add or remove, by their ID (which is
 * their name): archiving takes INBOX off, marking read takes UNREAD off,
 * starring adds STARRED (Gmail gives it the first icon in its star
 * settings; the API sets no icon). Gmail reserves the names, so no user
 * label has them.
 */
export const WRITABLE_FLAGS = new Set(["INBOX", "UNREAD", "STARRED"]);

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
    const icon = ICON_OF_LABEL.get(id);
    if (icon) state.starIcon = icon;
    const label = labels.get(id);
    if (label) applyLabel(state, label);
  }
  // Should Gmail ever list the hidden label, the icon is known without a
  // search; and a star taken off takes its icon with it.
  if (state.starIcon && !state.flags.starred) state.starIcon = null;
  return sortState(state);
};

/**
 * Gmail's hidden label for each star icon. The search box's names
 * (`has:red-bang`) find nothing through the API; these do (`l:^ss_cr`).
 * Stars are `^ss_s` and a colour, the other icons `^ss_c` and one.
 */
export const STAR_ICON_LABELS: Record<MailStarIcon, string> = {
  "yellow-star": "^ss_sy",
  "orange-star": "^ss_so",
  "red-star": "^ss_sr",
  "purple-star": "^ss_sp",
  "blue-star": "^ss_sb",
  "green-star": "^ss_sg",
  "red-bang": "^ss_cr",
  "orange-guillemet": "^ss_co",
  "yellow-bang": "^ss_cy",
  "green-check": "^ss_cg",
  "blue-info": "^ss_cb",
  "purple-question": "^ss_cp",
};

const ICON_OF_LABEL = new Map(
  MAIL_STAR_ICONS.map((icon) => [STAR_ICON_LABELS[icon], icon] as const),
);

/** Whether a label ID is one of the star icons' hidden labels. */
export const isStarIconLabel = (id: string): boolean => id.startsWith("^ss_");

/**
 * Which starred message has which star icon. Gmail's API names only
 * STARRED among a message's labels; a search on each icon's hidden label
 * tells them apart: one search per icon, each a page or two.
 */
export const readStarIcons = async (
  mailbox: GmailMailbox,
): Promise<Map<string, MailStarIcon>> => {
  const icons = new Map<string, MailStarIcon>();
  for (const icon of MAIL_STAR_ICONS) {
    const query = `l:${STAR_ICON_LABELS[icon]}`;
    for (const id of await mailbox.messageIds(undefined, query)) {
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
  state.starIcon = state.flags.starred
    ? (icons.get(id) ?? state.starIcon ?? null)
    : null;
  return state;
};
