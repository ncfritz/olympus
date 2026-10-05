import { importMailAccount } from "@ncfritz/olympus-sdk/minerva";
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
}
