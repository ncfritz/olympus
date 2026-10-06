import type { MailAuditLabel } from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";

/** A row of the Re-classification page's label tree. */
export type LabelNode = {
  /** The label's full name, unique: the row's key. */
  key: string;
  /** The last segment, shown indented under its parent. */
  leaf: string;
  /** False for a parent that is only a path, not a label of its own. */
  isLabel: boolean;
  messages: number;
  proposedIn: number;
  proposedOut: number;
  highConfidence: number;
  mergeCandidate: boolean;
  lastReceivedTime?: string;
  children?: LabelNode[];
};

/**
 * The labels as a tree by their `/` paths, siblings by name. A parent
 * missing from `labels` (Gmail can show one only as a path) gets a row of
 * its own with no counts.
 */
export const labelTree = (labels: MailAuditLabel[]): LabelNode[] => {
  const nodes = new Map<string, LabelNode>();
  const node = (name: string): LabelNode => {
    let found = nodes.get(name);
    if (!found) {
      found = {
        key: name,
        leaf: name.slice(name.lastIndexOf("/") + 1),
        isLabel: false,
        messages: 0,
        proposedIn: 0,
        proposedOut: 0,
        highConfidence: 0,
        mergeCandidate: false,
      };
      nodes.set(name, found);
    }
    return found;
  };
  for (const label of labels) {
    Object.assign(node(label.name), {
      isLabel: true,
      messages: label.messages,
      proposedIn: label.proposedIn,
      proposedOut: label.proposedOut,
      highConfidence: label.highConfidence,
      mergeCandidate: label.mergeCandidate,
      ...(label.lastReceivedTime
        ? { lastReceivedTime: label.lastReceivedTime }
        : {}),
    });
    // Its ancestors, so every path has a row.
    for (
      let i = label.name.indexOf("/");
      i > 0;
      i = label.name.indexOf("/", i + 1)
    ) {
      node(label.name.slice(0, i));
    }
  }
  const roots: LabelNode[] = [];
  for (const [name, n] of nodes) {
    const slash = name.lastIndexOf("/");
    if (slash > 0) {
      const parent = nodes.get(name.slice(0, slash))!;
      (parent.children ??= []).push(n);
    } else {
      roots.push(n);
    }
  }
  const sort = (list: LabelNode[]) => {
    list.sort((a, b) => a.key.localeCompare(b.key));
    list.forEach((n) => n.children && sort(n.children));
    return list;
  };
  return sort(roots);
};

/** No mail in two years, as of `now`. */
export const isDormant = (
  node: Pick<LabelNode, "isLabel" | "messages" | "lastReceivedTime">,
  now: DateTime = DateTime.now(),
): boolean =>
  node.isLabel &&
  node.messages > 0 &&
  node.lastReceivedTime !== undefined &&
  DateTime.fromISO(node.lastReceivedTime) < now.minus({ years: 2 });

/** A message or thread in Gmail, in the first signed-in account. */
export const gmailLink = (gmailId: string): string =>
  `https://mail.google.com/mail/u/0/#all/${gmailId}`;

/** A confidence as a whole percentage. */
export const percent = (confidence: number): string =>
  `${Math.round(confidence * 100)}%`;

/** The tree with only the rows `keep` accepts, and their ancestors. */
export const pruneTree = (
  nodes: LabelNode[],
  keep: (node: LabelNode) => boolean,
): LabelNode[] =>
  nodes.flatMap((n) => {
    const children = n.children ? pruneTree(n.children, keep) : [];
    if (!keep(n) && children.length === 0) return [];
    return [
      { ...n, ...(children.length ? { children } : { children: undefined }) },
    ];
  });
