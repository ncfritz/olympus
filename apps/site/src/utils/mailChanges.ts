import type {
  MailAuditChange,
  MailChangeBatch,
  MailLabelChange,
  MailProposalRef,
} from "@ncfritz/olympus-sdk/minerva";

/**
 * Selected proposals as what the API takes (docs/plans/email-management
 * phase 4): one batch per mail account, one change per message, its labels
 * to add and to remove gathered from every proposal for it. A label both
 * added and removed by the selection cancels out; a message left with
 * nothing to change is dropped.
 */
export const changesByAccount = (
  proposals: MailAuditChange[],
): Map<string, MailLabelChange[]> => {
  const byAccount = new Map<
    string,
    Map<string, { add: Set<string>; remove: Set<string> }>
  >();
  for (const p of proposals) {
    const messages =
      byAccount.get(p.message.accountId) ??
      new Map<string, { add: Set<string>; remove: Set<string> }>();
    byAccount.set(p.message.accountId, messages);
    const change = messages.get(p.message.gmailId) ?? {
      add: new Set<string>(),
      remove: new Set<string>(),
    };
    messages.set(p.message.gmailId, change);
    (p.action === "add" ? change.add : change.remove).add(p.label);
  }
  const result = new Map<string, MailLabelChange[]>();
  for (const [accountId, messages] of byAccount) {
    const changes: MailLabelChange[] = [];
    for (const [gmailId, c] of messages) {
      const add = [...c.add].filter((l) => !c.remove.has(l)).sort();
      const remove = [...c.remove].filter((l) => !c.add.has(l)).sort();
      if (add.length + remove.length) changes.push({ gmailId, add, remove });
    }
    if (changes.length) result.set(accountId, changes);
  }
  return result;
};

/** Selected proposals to mark processed, by account. */
export const proposalsByAccount = (
  proposals: MailAuditChange[],
): Map<string, MailProposalRef[]> => {
  const result = new Map<string, MailProposalRef[]>();
  for (const p of proposals) {
    const refs = result.get(p.message.accountId) ?? [];
    refs.push({ gmailId: p.message.gmailId, label: p.label, action: p.action });
    result.set(p.message.accountId, refs);
  }
  return result;
};

/** A proposal's row key in the review table, unique across rules. */
export const proposalKey = (c: MailAuditChange): string =>
  `${c.message.gmailId}\u0000${c.label}\u0000${c.action}\u0000${c.rule}`;

/** A batch's outcome in a few words, for the change log. */
export const batchSummary = (b: MailChangeBatch): string => {
  const c = b.counts;
  const parts = [
    c.written ? `${c.written.toLocaleString()} written` : "",
    c.unchanged ? `${c.unchanged.toLocaleString()} already so` : "",
    c.changed ? `${c.changed.toLocaleString()} changed in Gmail since` : "",
    c.gone ? `${c.gone.toLocaleString()} gone` : "",
    c.failed ? `${c.failed.toLocaleString()} failed` : "",
    c.pending ? `${c.pending.toLocaleString()} to go` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "nothing yet";
};

/** Whether a batch can be undone from the change log. */
export const canUndo = (b: MailChangeBatch): boolean =>
  b.kind === "apply" &&
  b.status === "done" &&
  !b.undoneByBatchId &&
  b.counts.written > 0;
