import type { MailLabel } from "@ncfritz/olympus-sdk/minerva";

/** A family the labels' names suggest, ready to create. */
export type SuggestedFamily = {
  name: string;
  states: { labelId: string; name: string; open: boolean }[];
  initialLabelId: string;
  transitions: { fromLabelId: string; toLabelId: string }[];
};

/** Names that read as an action done: a closed state. */
const CLOSED =
  /(^|[^a-z])(paid|done|complete|completed|closed|resolved|finished|filed)($|[^a-z])/i;

/**
 * Families the label names suggest: two or more topical siblings whose
 * last segment starts with `*` (`Bills/*Payable`, `Bills/*Paid`), named
 * for their parent. Names like "paid" or "done" are closed, the rest
 * open; the first open one is initial, and each open state moves to each
 * closed one. Only a suggestion: the page asks before creating it.
 */
export const suggestFamilies = (
  labels: MailLabel[],
  existing: string[] = [],
): SuggestedFamily[] => {
  const byParent = new Map<string, MailLabel[]>();
  for (const label of labels) {
    const slash = label.name.lastIndexOf("/");
    if (slash < 0 || label.kind !== "topical") continue;
    if (!label.name.slice(slash + 1).startsWith("*")) continue;
    const parent = label.name.slice(0, slash);
    byParent.set(parent, [...(byParent.get(parent) ?? []), label]);
  }
  const taken = new Set(existing);
  return [...byParent]
    .filter(([parent, siblings]) => siblings.length >= 2 && !taken.has(parent))
    .map(([parent, siblings]) => {
      const states = siblings
        .map((l) => ({
          labelId: l.id,
          name: l.name,
          open: !CLOSED.test(l.name.slice(l.name.lastIndexOf("/") + 2)),
        }))
        .sort(
          (a, b) =>
            Number(b.open) - Number(a.open) || a.name.localeCompare(b.name),
        );
      const open = states.filter((s) => s.open);
      const closed = states.filter((s) => !s.open);
      return {
        name: parent,
        states,
        initialLabelId: (open[0] ?? states[0]).labelId,
        transitions: open.flatMap((o) =>
          closed.map((c) => ({ fromLabelId: o.labelId, toLabelId: c.labelId })),
        ),
      };
    })
    .filter((f) => f.states.some((s) => s.open))
    .sort((a, b) => a.name.localeCompare(b.name));
};
