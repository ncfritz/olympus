import type { MailFlags } from "../MailSourceMessage";

/**
 * `X-Gmail-Labels`: label names separated by commas, a name with a comma
 * or a quote in double quotes (`""` for a quote).
 */
export const parseLabelHeader = (value: string): string[] => {
  const names: string[] = [];
  let name = "";
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quoted) {
      if (c === '"' && value[i + 1] === '"') {
        name += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        name += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      names.push(name);
      name = "";
    } else {
      name += c;
    }
  }
  names.push(name);
  return names.map((n) => n.trim()).filter((n) => n.length > 0);
};

/** Labels Takeout adds that are not Gmail's: read state and archived. */
const PSEUDO = new Set(["Archived", "Opened"]);

const SYSTEM: Record<string, keyof MailFlags> = {
  Inbox: "inbox",
  Unread: "unread",
  Starred: "starred",
  Important: "important",
  Sent: "sent",
  Draft: "draft",
  Drafts: "draft",
  Trash: "trash",
  Spam: "spam",
  Chat: "chat",
};

const CATEGORY = /^Category (.+)$/;

export type ClassifiedLabels = {
  labels: string[];
  flags: MailFlags;
  categories: string[];
};

export const noFlags = (): MailFlags => ({
  inbox: false,
  unread: false,
  starred: false,
  important: false,
  sent: false,
  draft: false,
  trash: false,
  spam: false,
  chat: false,
});

/**
 * Splits Takeout's label names into user labels, system flags and
 * categories, and drops its pseudo-labels.
 */
export const classifyLabels = (names: string[]): ClassifiedLabels => {
  const flags = noFlags();
  const labels: string[] = [];
  const categories: string[] = [];
  for (const name of names) {
    if (PSEUDO.has(name)) continue;
    const flag = SYSTEM[name];
    if (flag) {
      flags[flag] = true;
      continue;
    }
    const category = CATEGORY.exec(name);
    if (category) {
      categories.push(category[1].toLowerCase());
      continue;
    }
    labels.push(name);
  }
  return { labels, flags, categories };
};
