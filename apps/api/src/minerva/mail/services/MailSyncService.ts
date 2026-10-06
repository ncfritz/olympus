import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GmailLabel,
  ListMailMessageStatesResponse,
  MailAccount,
  MailMessageState,
  SyncMailLabelsResponse,
  UpdateMailAccountSyncRequest,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import {
  toDomainObject,
  type GraphQlMailAccount,
} from "../converters/MailAccountConverter";

export const MAX_STATE_PAGE = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;
const CATEGORY_LABEL = /^CATEGORY_([A-Z]{1,30})$/;

type GraphQlState = {
  gmailId: string;
  inInbox: boolean;
  unread: boolean;
  starred: boolean;
  important: boolean;
  sent: boolean;
  messageLabels: { label: { name: string; type: string } }[];
};

const toState = (m: GraphQlState): MailMessageState => {
  const labels: string[] = [];
  const categories: string[] = [];
  for (const { label } of m.messageLabels) {
    const category = CATEGORY_LABEL.exec(label.name);
    if (label.type === "system" && category) {
      categories.push(category[1].toLowerCase());
    } else if (label.type === "user") {
      labels.push(label.name);
    }
  }
  return {
    gmailId: m.gmailId,
    labels: labels.sort(),
    categories: categories.sort(),
    flags: {
      inbox: m.inInbox,
      unread: m.unread,
      starred: m.starred,
      important: m.important,
      sent: m.sent,
    },
  };
};

const requireAccountId = (accountId: string): string => {
  if (!UUID.test(accountId)) {
    throw new BadRequestException("accountId must be a mail account ID");
  }
  return accountId;
};

/**
 * Keeping a linked mailbox in step with Gmail (docs/plans/email-management
 * phase 1b), for the mail agent: Minerva's labels and flags per message, to
 * compare with Gmail's; Gmail's label IDs; and the sync, once done. The
 * changes themselves arrive on mail.messages, as the import's did.
 */
@Injectable()
export class MailSyncService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * A page of the account's messages' labels and flags, by Gmail ID.
   *
   * @throws BadRequestException a parameter is not what it should be
   * @throws NotFoundException no such account
   */
  async listStates(
    accountId: string,
    after: string | undefined,
    limit: number,
  ): Promise<ListMailMessageStatesResponse> {
    requireAccountId(accountId);
    if (after !== undefined && !GMAIL_ID.test(after)) {
      throw new BadRequestException("after must be a Gmail message ID");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_STATE_PAGE) {
      throw new BadRequestException(
        `limit must be between 1 and ${MAX_STATE_PAGE}`,
      );
    }
    await this.account(accountId);
    const query = gql`
      query ListMailMessageStates(
        $where: minerva_mail_messages_bool_exp!
        $limit: Int!
      ) {
        minerva_mail_messages(
          where: $where
          order_by: { gmailId: asc }
          limit: $limit
        ) {
          gmailId
          inInbox
          unread
          starred
          important
          sent
          messageLabels {
            label {
              name
              type
            }
          }
        }
      }
    `;
    const where = {
      accountId: { _eq: accountId },
      ...(after !== undefined ? { gmailId: { _gt: after } } : {}),
    };
    const response = await this.graphQLClient.request<{
      minerva_mail_messages: GraphQlState[];
    }>(query, { where, limit });
    const rows = response.minerva_mail_messages;
    return {
      messages: rows.map(toState),
      nextCursor:
        rows.length === limit ? rows[rows.length - 1].gmailId : undefined,
    };
  }

  /**
   * Gives the account's labels their Gmail IDs by name, and adds the user
   * labels made in Gmail since the import. Labels Gmail no longer has are
   * kept and named: they keep their kinds, and the messages' own labels
   * say whether they are still used.
   */
  async syncLabels(
    accountId: string,
    labels: GmailLabel[] | undefined,
  ): Promise<SyncMailLabelsResponse> {
    requireAccountId(accountId);
    if (!Array.isArray(labels) || labels.length > 10_000) {
      throw new BadRequestException("labels must be a list of at most 10,000");
    }
    labels.forEach((l, i) => {
      if (
        !l ||
        typeof l.gmailLabelId !== "string" ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(l.gmailLabelId) ||
        typeof l.name !== "string" ||
        l.name.length < 1 ||
        l.name.length > 225 ||
        l.name !== l.name.trim() ||
        (l.type !== "user" && l.type !== "system")
      ) {
        throw new BadRequestException(
          `labels[${i}] must have a Gmail label ID, a name of 1 to 225 characters and a type of user or system`,
        );
      }
    });
    await this.account(accountId);

    // Minerva keeps user labels by name and Gmail's categories as system
    // labels named by their ID; Gmail's other system labels are flags.
    const wanted = new Map<string, { gmailLabelId: string; type: string }>();
    for (const l of labels) {
      if (l.type === "user") {
        wanted.set(l.name, { gmailLabelId: l.gmailLabelId, type: "user" });
      } else if (CATEGORY_LABEL.test(l.gmailLabelId)) {
        wanted.set(l.gmailLabelId, {
          gmailLabelId: l.gmailLabelId,
          type: "system",
        });
      }
    }

    const query = gql`
      query ListMailLabelsForSync($accountId: uuid!) {
        minerva_mail_labels(where: { accountId: { _eq: $accountId } }) {
          name
          type
        }
      }
    `;
    const existing = (
      await this.graphQLClient.request<{
        minerva_mail_labels: { name: string; type: string }[];
      }>(query, { accountId })
    ).minerva_mail_labels;
    const known = new Set(existing.map((l) => l.name));
    const missing = [...wanted].filter(([name]) => !known.has(name));

    const write = gql`
      mutation SyncMailLabels($labels: [minerva_mail_labels_insert_input!]!) {
        insert_minerva_mail_labels(
          objects: $labels
          on_conflict: {
            constraint: mail_labels_account_id_name_key
            update_columns: [gmailLabelId]
          }
        ) {
          affected_rows
        }
      }
    `;
    if (wanted.size > 0) {
      await this.graphQLClient.request(write, {
        labels: [...wanted].map(([name, l]) => ({
          accountId,
          name,
          type: l.type,
          gmailLabelId: l.gmailLabelId,
        })),
      });
    }
    return {
      matched: wanted.size - missing.length,
      created: missing.length,
      notInGmail: existing
        .filter((l) => l.type === "user" && !wanted.has(l.name))
        .map((l) => l.name)
        .sort(),
    };
  }

  /** Records a finished reconcile: where history carries on, and Gmail's totals. */
  async recordSync(
    accountId: string,
    request: UpdateMailAccountSyncRequest,
  ): Promise<MailAccount> {
    requireAccountId(accountId);
    const historyId = request?.historyId;
    if (typeof historyId !== "string" || !/^[0-9]{1,20}$/.test(historyId)) {
      throw new BadRequestException(
        "historyId must be Gmail's history ID, digits",
      );
    }
    for (const key of ["messagesTotal", "threadsTotal"] as const) {
      const value = request[key];
      if (!Number.isInteger(value) || value < 0 || value > 2_147_483_647) {
        throw new BadRequestException(
          `${key} must be a whole number, 0 or more`,
        );
      }
    }
    await this.account(accountId);
    const mutation = gql`
      mutation UpdateMailAccountSync(
        $id: uuid!
        $sync: minerva_mail_accounts_set_input!
      ) {
        update_minerva_mail_accounts_by_pk(
          pk_columns: { id: $id }
          _set: $sync
        ) {
          id
          userId
          email
          verificationMethod
          verifiedTime
          linkedTime
          linkScope
          syncedTime
          gmailMessagesTotal
          gmailThreadsTotal
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_minerva_mail_accounts_by_pk: GraphQlMailAccount;
    }>(mutation, {
      id: accountId,
      sync: {
        historyId,
        syncedTime: new Date().toISOString(),
        gmailMessagesTotal: request.messagesTotal,
        gmailThreadsTotal: request.threadsTotal,
      },
    });
    return toDomainObject(response.update_minerva_mail_accounts_by_pk);
  }

  private async account(accountId: string): Promise<void> {
    const query = gql`
      query DescribeMailSyncAccount($accountId: uuid!) {
        minerva_mail_accounts_by_pk(id: $accountId) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts_by_pk: { id: string } | null;
    }>(query, { accountId });
    if (!response.minerva_mail_accounts_by_pk) {
      throw new NotFoundException(`No mail account ${accountId}`);
    }
  }
}
