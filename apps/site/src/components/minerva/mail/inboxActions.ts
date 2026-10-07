import type {
  MailChangeBatch,
  MailInboxMessage,
} from "@ncfritz/olympus-sdk/minerva";
import mailApi from "../../../api/mailApi";
import {
  type ApproveOptions,
  chunked,
  gmailIdsByAccount,
  HIGH_CONFIDENCE,
  startOfToday,
  suggestedApprovals,
} from "../../../utils/mailInbox";

/** An inbox action takes at most this many messages a call. */
const PER_CALL = 500;
/** Accept all ≥ 90% takes at most this many messages at once. */
const ACCEPT_ALL_MAX = 1000;

export type InboxActionResult = {
  messages: number;
  batches: MailChangeBatch[];
};

/** Approves messages as suggested, a call per account and 500. */
export const approveSuggested = async (
  messages: MailInboxMessage[],
  options: ApproveOptions,
): Promise<InboxActionResult> => {
  const result: InboxActionResult = { messages: 0, batches: [] };
  for (const [accountId, approvals] of suggestedApprovals(messages)) {
    for (const chunk of chunked(approvals, PER_CALL)) {
      const done = (
        await mailApi.approveMessages(accountId, {
          messages: chunk,
          ...options,
        })
      ).data;
      result.messages += done.approved;
      if (done.batch) result.batches.push(done.batch);
    }
  }
  return result;
};

/** Every message to review with a suggestion of 90% or more. */
export const highConfidenceToReview = async (
  accountId?: string,
): Promise<MailInboxMessage[]> => {
  const found: MailInboxMessage[] = [];
  for (let page = 0; found.length < ACCEPT_ALL_MAX; page++) {
    const body = (
      await mailApi.listInbox({
        status: "review",
        minConfidence: HIGH_CONFIDENCE,
        sortBy: "confidence",
        approvedSince: startOfToday(),
        ...(accountId ? { accountId } : {}),
        pageSize: 100,
        startPage: page,
      })
    ).data;
    found.push(...body.messages);
    if (body.messages.length < 100) break;
  }
  return found.slice(0, ACCEPT_ALL_MAX);
};

export const skipAll = async (
  messages: MailInboxMessage[],
): Promise<number> => {
  let skipped = 0;
  for (const [accountId, ids] of gmailIdsByAccount(messages)) {
    for (const chunk of chunked(ids, PER_CALL)) {
      skipped += (await mailApi.skipMessages(accountId, chunk)).data.skipped;
    }
  }
  return skipped;
};

export const flagAll = async (
  messages: MailInboxMessage[],
  flags: { archive?: boolean; markRead?: boolean },
): Promise<InboxActionResult> => {
  const result: InboxActionResult = { messages: 0, batches: [] };
  for (const [accountId, ids] of gmailIdsByAccount(messages)) {
    for (const chunk of chunked(ids, PER_CALL)) {
      const done = (
        await mailApi.updateFlags(accountId, { gmailIds: chunk, ...flags })
      ).data;
      result.messages += done.changed;
      if (done.batch) result.batches.push(done.batch);
    }
  }
  return result;
};
