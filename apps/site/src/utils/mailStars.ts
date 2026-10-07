import type {
  MailLabelChange,
  MailStarIcon,
  MailStarMismatch,
} from "@ncfritz/olympus-sdk/minerva";

/** Gmail's star icons as its settings name them. */
export const STAR_NAMES: Record<MailStarIcon, string> = {
  "yellow-star": "yellow star",
  "orange-star": "orange star",
  "red-star": "red star",
  "purple-star": "purple star",
  "blue-star": "blue star",
  "green-star": "green star",
  "red-bang": "red bang",
  "orange-guillemet": "orange guillemet",
  "yellow-bang": "yellow bang",
  "green-check": "green check",
  "blue-info": "blue info",
  "purple-question": "purple question",
};

/** An icon's name, or "a star" when sync has not found which. */
export const starName = (icon?: MailStarIcon): string =>
  icon ? STAR_NAMES[icon] : "a star";

/** What a mismatch wants done, in words. */
export const fixText = (m: MailStarMismatch): string =>
  m.fix === "star"
    ? `Star it (then set the ${starName(m.wanted)} in Gmail)`
    : `Set the ${starName(m.wanted)} in Gmail`;

/** Starring messages: STARRED added, by account. */
export const starChanges = (
  mismatches: MailStarMismatch[],
): Map<string, MailLabelChange[]> => {
  const byAccount = new Map<string, Map<string, MailLabelChange>>();
  for (const m of mismatches) {
    if (m.fix !== "star") continue;
    const changes = byAccount.get(m.accountId) ?? new Map();
    byAccount.set(m.accountId, changes);
    changes.set(m.gmailId, {
      gmailId: m.gmailId,
      add: ["STARRED"],
      remove: [],
    });
  }
  return new Map([...byAccount].map(([a, c]) => [a, [...c.values()]]));
};
