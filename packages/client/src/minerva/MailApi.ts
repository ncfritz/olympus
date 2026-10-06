import {
  type GmailLabel,
  importMailAccount,
  listMailMessageStates,
  listMailTrainingAccounts,
  syncMailLabels,
  updateMailAccountSync,
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
}
