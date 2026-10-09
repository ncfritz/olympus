import type {
  MailCluster,
  MailClusterPoint,
  MailLabelChange,
} from "@ncfritz/olympus-sdk/minerva";

/** The colours of the map's label groups, busiest first. */
export const GROUP_COLORS = [
  "#32485c",
  "#67598c",
  "#c05a91",
  "#df5b84",
  "#ff7356",
  "#ffa600",
  "#3f8f8a",
  "#7aa95c",
  "#4f7cac",
  "#a0522d",
];
export const OTHER_COLOR = "#9aa5b1";
export const UNLABELLED_COLOR = "#d0d5db";
export const OTHER_LABELS = "Other labels";
export const UNLABELLED = "Unlabelled";

/** How many messages one change batch takes (ApplyMailChanges). */
export const APPLY_BATCH = 10_000;
/** How many of a cluster's messages one page brings. */
export const MEMBER_PAGE = 5_000;

/** A label's top-level part: `Finance/Utilities` → `Finance`. */
export const topLevel = (label: string): string => label.split("/")[0];

export type MapPoint = {
  x: number;
  y: number;
  gmailId: string;
  clusterId?: string;
  label?: string;
};

export type PointGroup = {
  name: string;
  color: string;
  points: MapPoint[];
};

/**
 * The map's points as groups to colour: one per top-level label, the
 * busiest `max` with colours of their own, the rest as Other labels, and
 * the unlabelled last.
 */
export const pointGroups = (
  points: MailClusterPoint[],
  max = GROUP_COLORS.length,
): PointGroup[] => {
  const byGroup = new Map<string, MapPoint[]>();
  const unlabelled: MapPoint[] = [];
  for (const p of points) {
    const point: MapPoint = {
      x: p.x,
      y: p.y,
      gmailId: p.gmailId,
      ...(p.clusterId ? { clusterId: p.clusterId } : {}),
      ...(p.label ? { label: p.label } : {}),
    };
    if (!p.label) {
      unlabelled.push(point);
      continue;
    }
    const group = topLevel(p.label);
    byGroup.set(group, [...(byGroup.get(group) ?? []), point]);
  }
  const ordered = [...byGroup].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  const groups: PointGroup[] = ordered.slice(0, max).map(([name, p], i) => ({
    name,
    color: GROUP_COLORS[i % GROUP_COLORS.length],
    points: p,
  }));
  const rest = ordered.slice(max).flatMap(([, p]) => p);
  if (rest.length) {
    groups.push({ name: OTHER_LABELS, color: OTHER_COLOR, points: rest });
  }
  if (unlabelled.length) {
    groups.push({
      name: UNLABELLED,
      color: UNLABELLED_COLOR,
      points: unlabelled,
    });
  }
  return groups;
};

/** What a cluster suggests, in a few words; undefined when nothing. */
export const suggestionText = (c: MailCluster): string | undefined => {
  if (!c.suggestion || !c.proposedName) return undefined;
  return c.suggestion === "new-label"
    ? `A new label, ${c.proposedName}`
    : `A sub-label of ${c.scopeLabel}, ${c.proposedName}`;
};

/** What applying a cluster's suggestion does, for its confirmation. */
export const applyText = (c: MailCluster): string =>
  c.suggestion === "split"
    ? `Creates ${c.proposedName} in Gmail and moves this group's ${c.size.toLocaleString()} messages into it from ${c.scopeLabel}. The rest of ${c.scopeLabel} stays. It can be undone from the change log.`
    : `Creates ${c.proposedName} in Gmail and adds it to this cluster's ${c.size.toLocaleString()} messages. It can be undone from the change log.`;

/** The share of a cluster's messages with its most common label. */
export const purityText = (c: MailCluster): string =>
  c.labels.length
    ? `${Math.round(c.purity * 100)}% ${c.labels[0].label}`
    : "No labels";

/** Clusters worth a look: those that suggest something, largest first. */
export const worthALook = (clusters: MailCluster[]): MailCluster[] =>
  clusters
    .filter((c) => c.suggestion && c.proposedName)
    .sort((a, b) => b.size - a.size || a.number - b.number);

/** The label changes that apply a cluster's suggestion to its messages. */
export const clusterChanges = (
  c: MailCluster,
  gmailIds: string[],
): MailLabelChange[] => {
  if (!c.suggestion || !c.proposedName) return [];
  const remove = c.suggestion === "split" && c.scopeLabel ? [c.scopeLabel] : [];
  return [...new Set(gmailIds)].map((gmailId) => ({
    gmailId,
    add: [c.proposedName as string],
    remove,
  }));
};

/** Items in runs of at most `size`. */
export const chunks = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

/** Where a cluster's label is reviewed: its label's, or the whole tree. */
export const reviewHref = (c: MailCluster): string =>
  c.scopeLabel
    ? `/minerva/mail/reclassification/label?name=${encodeURIComponent(c.scopeLabel)}`
    : "/minerva/mail/reclassification";

/** Where the map opens on a cluster. */
export const clusterHref = (c: MailCluster): string =>
  `/minerva/mail/clusters?cluster=${encodeURIComponent(c.id)}`;

/** A label's split suggestion: how many groups, and their messages. */
export type LabelSplit = { groups: number; messages: number };

/** Each label the clustering would split, from the clusters suggesting. */
export const splitsByLabel = (
  clusters: MailCluster[],
): Map<string, LabelSplit> => {
  const out = new Map<string, LabelSplit>();
  for (const c of clusters) {
    if (c.suggestion !== "split" || !c.scopeLabel) continue;
    const s = out.get(c.scopeLabel) ?? { groups: 0, messages: 0 };
    out.set(c.scopeLabel, {
      groups: s.groups + 1,
      messages: s.messages + c.size,
    });
  }
  return out;
};
