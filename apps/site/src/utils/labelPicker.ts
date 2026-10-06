import type {
  MailAuditChange,
  MailLabel,
  MailLabelChange,
} from "@ncfritz/olympus-sdk/minerva";

/**
 * The label picker's logic (docs/plans/email-management/design.md, The
 * label picker), kept apart from the component so it can be tested.
 */

/** A message as the picker sees it: where it is and its labels now. */
export type PickerMessage = {
  gmailId: string;
  accountId: string;
  labels: string[];
};

/**
 * What applying does with a label: put it on every message, take it off
 * every one, or leave each as it is (only for a label on some of them).
 */
export type LabelWant = "all" | "none" | "keep";

export type LabelWants = Record<string, LabelWant>;

/** A label offered, merged across mailboxes by name. */
export type PickerOption = {
  name: string;
  kind: MailLabel["kind"];
  messages: number;
  familyId?: string;
  familyName?: string;
  mergeTargetName?: string;
};

/** A suggestion among the selection, from its proposals. */
export type PickerSuggestion = {
  label: string;
  /** Messages it is suggested for. */
  messages: number;
  /** The highest confidence among them. */
  confidence: number;
};

/** One label's effect on the selection, for the Changes line. */
export type LabelEffect = {
  label: string;
  /** Messages it is on now. */
  on: number;
  adding: number;
  removing: number;
};

export const RECENT_KEY = "minerva.mail.recentLabels";
export const RECENT_MAX = 8;

/** The account's labels merged by name, system labels left out. */
export const pickerOptions = (labels: MailLabel[]): PickerOption[] => {
  const byName = new Map<string, PickerOption>();
  for (const l of labels) {
    if (l.kind === "system") continue;
    const seen = byName.get(l.name);
    if (seen) {
      seen.messages += l.messages;
      continue;
    }
    byName.set(l.name, {
      name: l.name,
      kind: l.kind,
      messages: l.messages,
      ...(l.familyId ? { familyId: l.familyId } : {}),
      ...(l.familyName ? { familyName: l.familyName } : {}),
      ...(l.mergeTargetName ? { mergeTargetName: l.mergeTargetName } : {}),
    });
  }
  return [...byName.values()];
};

/**
 * Whether `query` matches `path` in order, ignoring case and spaces
 * ("shret" finds `Shopping/Returns`), and how loosely: the number of
 * jumps between matched runs, fewer being better. Undefined when it does
 * not match.
 */
export const pathMatch = (query: string, path: string): number | undefined => {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return 0;
  const p = path.toLowerCase();
  let at = -1;
  let jumps = 0;
  for (const ch of q) {
    const next = p.indexOf(ch, at + 1);
    if (next < 0) return undefined;
    if (at >= 0 && next !== at + 1) jumps++;
    at = next;
  }
  return jumps;
};

/** Labels matching a query, best first; ties go to the more used. */
export const searchLabels = (
  query: string,
  options: PickerOption[],
  limit = 50,
): PickerOption[] =>
  options
    .map((o) => ({ o, jumps: pathMatch(query, o.name) }))
    .filter(
      (m): m is { o: PickerOption; jumps: number } => m.jumps !== undefined,
    )
    .sort(
      (a, b) =>
        a.jumps - b.jumps ||
        b.o.messages - a.o.messages ||
        a.o.name.localeCompare(b.o.name),
    )
    .slice(0, limit)
    .map((m) => m.o);

/**
 * A label path that could be created: no empty part, no leading or
 * trailing `/`. Gmail itself rejects its own system names.
 */
export const validNewPath = (path: string): boolean => {
  const p = path.trim();
  return p.length > 0 && p.split("/").every((part) => part.trim().length > 0);
};

/** How many of the messages have the label now. */
export const countOn = (messages: PickerMessage[], label: string): number =>
  messages.filter((m) => m.labels.includes(label)).length;

/** Every label on at least one of the messages, by how many have it. */
export const labelsOn = (messages: PickerMessage[]): string[] => {
  const counts = new Map<string, number>();
  for (const m of messages) {
    for (const l of m.labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([l]) => l);
};

/** What a label's checkbox shows: keep on all of them is all, on none is none. */
export const effectiveWant = (
  want: LabelWant | undefined,
  on: number,
  total: number,
): LabelWant => {
  const w = want ?? "keep";
  if (w !== "keep") return w;
  return on === 0 ? "none" : on === total ? "all" : "keep";
};

/**
 * The checkbox's next state when clicked: on all → off all; off all → as
 * it was, for a label on some of them, else on all; as it was → on all.
 */
export const nextWant = (
  want: LabelWant | undefined,
  on: number,
  total: number,
): LabelWant => {
  const now = effectiveWant(want, on, total);
  if (now === "all") return "none";
  if (now === "none") return on > 0 && on < total ? "keep" : "all";
  return "all";
};

/**
 * Picking a label: it goes on every message. A retired label is replaced
 * by its merge target; a state takes its family's other states off. The
 * notes say what was done instead of, or as well as, the pick.
 */
export const pickLabel = (
  wants: LabelWants,
  name: string,
  options: PickerOption[],
): { wants: LabelWants; notes: string[]; label: string } => {
  const byName = new Map(options.map((o) => [o.name, o]));
  const notes: string[] = [];
  let label = name;
  const picked = byName.get(name);
  if (picked?.kind === "retired" && picked.mergeTargetName) {
    label = picked.mergeTargetName;
    notes.push(`${name} is retired: ${label} applied instead`);
  }
  const next: LabelWants = { ...wants, [label]: "all" };
  const target = byName.get(label);
  if (target?.kind === "state" && target.familyId) {
    const replaced = options.filter(
      (o) =>
        o.familyId === target.familyId &&
        o.kind === "state" &&
        o.name !== label,
    );
    for (const o of replaced) next[o.name] = "none";
    if (replaced.length) {
      notes.push(
        `${label} replaces ${replaced.map((o) => o.name).join(", ")}${
          target.familyName ? ` (${target.familyName})` : ""
        }`,
      );
    }
  }
  return { wants: next, notes, label };
};

/** What applying would do with each label that changes anything. */
export const labelEffects = (
  messages: PickerMessage[],
  wants: LabelWants,
): LabelEffect[] =>
  Object.entries(wants)
    .map(([label, want]) => {
      const on = countOn(messages, label);
      return {
        label,
        on,
        adding: want === "all" ? messages.length - on : 0,
        removing: want === "none" ? on : 0,
      };
    })
    .filter((e) => e.adding + e.removing > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

/** "on 7 of 12", or what applying changes: "adding to 5 · already on 7". */
export const describeWant = (
  want: LabelWant | undefined,
  on: number,
  total: number,
): string => {
  const now = effectiveWant(want, on, total);
  const single = total === 1;
  if (now === "all" && on < total) {
    if (single) return "adding";
    return on
      ? `adding to ${total - on} · already on ${on}`
      : `adding to ${total}`;
  }
  if (now === "none" && on > 0)
    return single ? "removing" : `removing from ${on}`;
  if (single) return on ? "on it" : "not on it";
  return `on ${on} of ${total}`;
};

/**
 * The changes to apply, one batch per mailbox: each message's labels to add
 * and remove, and the labels its mailbox must create first. A message with
 * nothing to change is left out.
 */
export const bulkChanges = (
  messages: PickerMessage[],
  wants: LabelWants,
  labels: MailLabel[],
): Map<string, { changes: MailLabelChange[]; newLabels: string[] }> => {
  const known = new Map<string, Set<string>>();
  for (const l of labels) {
    const names = known.get(l.accountId) ?? new Set<string>();
    names.add(l.name);
    known.set(l.accountId, names);
  }
  const result = new Map<
    string,
    { changes: MailLabelChange[]; newLabels: Set<string> }
  >();
  for (const m of messages) {
    const add: string[] = [];
    const remove: string[] = [];
    for (const [label, want] of Object.entries(wants)) {
      const has = m.labels.includes(label);
      if (want === "all" && !has) add.push(label);
      if (want === "none" && has) remove.push(label);
    }
    if (!add.length && !remove.length) continue;
    const batch = result.get(m.accountId) ?? {
      changes: [],
      newLabels: new Set<string>(),
    };
    result.set(m.accountId, batch);
    batch.changes.push({
      gmailId: m.gmailId,
      add: add.sort(),
      remove: remove.sort(),
    });
    const names = known.get(m.accountId) ?? new Set<string>();
    for (const l of add) if (!names.has(l)) batch.newLabels.add(l);
  }
  return new Map(
    [...result].map(([a, b]) => [
      a,
      { changes: b.changes, newLabels: [...b.newLabels].sort() },
    ]),
  );
};

/** Recently picked labels, newest first, with these put in front. */
export const withRecent = (recent: string[], picked: string[]): string[] =>
  [...new Set([...picked, ...recent])].slice(0, RECENT_MAX);

/** The selected proposals' messages, once each. */
export const pickerMessages = (
  proposals: MailAuditChange[],
): PickerMessage[] => {
  const byId = new Map<string, PickerMessage>();
  for (const p of proposals) {
    byId.set(`${p.message.accountId}\u0000${p.message.gmailId}`, {
      gmailId: p.message.gmailId,
      accountId: p.message.accountId,
      labels: p.message.labels,
    });
  }
  return [...byId.values()];
};

/**
 * The labels the selected proposals suggest adding, ticked or not, most
 * messages first.
 */
export const pickerSuggestions = (
  proposals: MailAuditChange[],
): PickerSuggestion[] => {
  const byLabel = new Map<string, { ids: Set<string>; confidence: number }>();
  for (const p of proposals) {
    if (p.action !== "add") continue;
    const s = byLabel.get(p.label) ?? { ids: new Set<string>(), confidence: 0 };
    s.ids.add(`${p.message.accountId}\u0000${p.message.gmailId}`);
    s.confidence = Math.max(s.confidence, p.confidence);
    byLabel.set(p.label, s);
  }
  return [...byLabel]
    .map(([label, s]) => ({
      label,
      messages: s.ids.size,
      confidence: s.confidence,
    }))
    .sort((a, b) => b.messages - a.messages || b.confidence - a.confidence);
};
