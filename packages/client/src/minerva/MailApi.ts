import {
  type GmailLabel,
  importMailAccount,
  listMailMessageStates,
  listMailSyncAccounts,
  listMailTrainingAccounts,
  recordMailMessageSuggestions,
  type RecordMailMessageSuggestionsRequest,
  syncMailLabels,
  updateMailAccountSync,
  updateMailChangeBatch,
  type UpdateMailChangeBatchRequest,
} from "@ncfritz/olympus-sdk/minerva";
import type { OlympusClients } from "../clients";

/** Minerva mail (ADR 0030), for agents. */
export class MailApi {
  constructor(private readonly clients: OlympusClients) {}

  /**
   * The mail account a Takeout archive is imported into: the mailbox at
   * `email`, made the user with `ownerEmail`'s if it is new.
   */
  async importMailAccount(email: string, ownerEmail: string) {
    const response = await importMailAccount({
      client: this.clients.minerva,
      body: { email, ownerEmail },
    });
    return response.data.mailAccount;
  }

  /** Every mail account, with its address. */
  async listMailTrainingAccounts() {
    const response = await listMailTrainingAccounts({
      client: this.clients.minerva,
    });
    return response.data.accounts;
  }

  /** Every account linked to Gmail, with the historyId to poll from. */
  async listMailSyncAccounts() {
    const response = await listMailSyncAccounts({
      client: this.clients.minerva,
    });
    return response.data.accounts;
  }

  /** A page of the account's messages' labels and flags, by Gmail ID. */
  async listMailMessageStates(accountId: string, after?: string, limit = 5000) {
    const response = await listMailMessageStates({
      client: this.clients.minerva,
      path: { accountId },
      query: { limit, ...(after ? { after } : {}) },
    });
    return response.data;
  }

  /** Gmail's labels for the mailbox: IDs by name, new ones added. */
  async syncMailLabels(accountId: string, labels: GmailLabel[]) {
    const response = await syncMailLabels({
      client: this.clients.minerva,
      path: { accountId },
      body: { labels },
    });
    return response.data;
  }

  /** Records new mail's suggested labels, each message's replacing its last. */
  async recordMailMessageSuggestions(
    accountId: string,
    scored: RecordMailMessageSuggestionsRequest,
  ) {
    const response = await recordMailMessageSuggestions({
      client: this.clients.minerva,
      path: { accountId },
      body: scored,
    });
    return response.data;
  }

  /** Records a finished reconcile. */
  async updateMailAccountSync(
    accountId: string,
    sync: { historyId: string; messagesTotal: number; threadsTotal: number },
  ) {
    const response = await updateMailAccountSync({
      client: this.clients.minerva,
      path: { accountId },
      body: sync,
    });
    return response.data.mailAccount;
  }

  /** Reports where a batch of label changes is, and outcomes since. */
  async updateMailChangeBatch(
    batchId: string,
    report: UpdateMailChangeBatchRequest,
  ) {
    const response = await updateMailChangeBatch({
      client: this.clients.minerva,
      path: { batchId },
      body: report,
    });
    return response.data.batch;
  }
}
