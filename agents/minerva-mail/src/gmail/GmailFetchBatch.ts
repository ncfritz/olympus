import type { ClassifierMessage } from "../classifier/ClassifierClient";
import { parseRawMessage } from "../sources/parseRawMessage";
import { noFlags } from "../sources/takeout/takeoutLabels";
import {
  FEATURIZE_BATCH,
  toClassifierMessage,
} from "../takeout/TakeoutFeaturize";
import { toMetadataMessage } from "../takeout/toMetadataMessage";
import { gmailStatusOf, type GmailMailbox } from "./GmailClient";
import type { GmailMessages } from "./GmailMessages";
import { type GmailState, toFlags } from "./gmailState";

/** What became of a message fetched whole. */
export type GmailFetchOutcome = "added" | "not-kept" | "gone";

/**
 * New mail fetched whole for one account: each message published, and its
 * text, held only until it is sent, featurized in batches.
 */
export class GmailFetchBatch {
  private pending: ClassifierMessage[] = [];
  featurized = 0;
  featurizeFailed = 0;

  constructor(
    private readonly messages: GmailMessages,
    private readonly accountId: string,
  ) {}

  /**
   * Fetches `id` (format raw), parses it as the import does, and publishes
   * it as message.upsert with the state `stateOf` gives its label IDs;
   * undefined there means Minerva does not keep it.
   *
   * @throws when Gmail fails other than with 404, or the text is not MIME
   */
  async add(
    mailbox: GmailMailbox,
    id: string,
    stateOf: (labelIds: string[]) => GmailState | undefined,
  ): Promise<GmailFetchOutcome> {
    let raw;
    try {
      raw = await mailbox.raw(id);
    } catch (error) {
      if (gmailStatusOf(error) === 404) return "gone";
      throw error;
    }
    const state = stateOf(raw.labelIds ?? []);
    if (!state) return "not-kept";
    const { message } = await parseRawMessage(
      Buffer.from(raw.raw, "base64url"),
      {
        gmailId: raw.id,
        threadId: raw.threadId,
        receivedAt: new Date(Number(raw.internalDate)).toISOString(),
        labels: state.labels,
        flags: { ...noFlags(), ...toFlags(state.flags) },
        categories: state.categories,
      },
    );
    await this.messages.publish("upsert", {
      ...toMetadataMessage(message, this.accountId, "gmail", new Date()),
      ...(state.starIcon !== undefined ? { starIcon: state.starIcon } : {}),
    });
    if (this.messages.featurizing) {
      this.pending.push(toClassifierMessage(message));
      if (this.pending.length >= FEATURIZE_BATCH) await this.flush();
    }
    return "added";
  }

  /** Sends what is waiting to the classifier. Its failure fails no sync. */
  async flush(): Promise<void> {
    if (this.pending.length === 0) return;
    const sent = this.pending;
    this.pending = [];
    try {
      this.featurized += (
        await this.messages.featurize(this.accountId, sent)
      ).stored;
    } catch (error) {
      this.featurizeFailed += sent.length;
      this.messages.warn(
        `Could not featurize ${sent.length} messages: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
