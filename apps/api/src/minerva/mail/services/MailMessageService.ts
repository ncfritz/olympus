import type { MailMessageAction } from "@ncfritz/olympus-messages";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  type MailLabelRef,
  toMailDeleteFields,
  toMailLabelsFields,
  toMailMessageFields,
} from "../converters/MailMessageConverter";

/** What became of one message's metadata. */
export type MailMessageOutcome =
  | { result: "written" }
  /** Minerva holds a newer snapshot of the message: this one is skipped. */
  | { result: "stale" }
  /** The account is gone: nothing to write it to. */
  | { result: "unknown_account" }
  | { result: "invalid"; problems: string[] };

/** Every column a message sets, so a repeated message rewrites the same row. */
const MESSAGE_COLUMNS = [
  "threadId",
  "source",
  "snapshotTime",
  "receivedTime",
  "sentTime",
  "fromAddress",
  "fromName",
  "deliveredTo",
  "listId",
  "hasListUnsubscribe",
  "messageIdHeader",
  "subject",
  "snippet",
  "sizeBytes",
  "inInbox",
  "unread",
  "starred",
  "starIcon",
  "important",
  "sent",
].join("\n");

/**
 * Writes the mail agent's message metadata into Minerva (ADR 0030): the
 * message by its account and Gmail ID, unless the row was written from a
 * newer snapshot; then its recipients, attachment types and labels, which
 * replace what the row had. A label is made the first time a name is
 * seen. Label and account IDs are kept for the life of the process:
 * nothing removes a label or an account while messages are imported.
 */
@Injectable()
export class MailMessageService {
  private readonly accounts = new Set<string>();
  private readonly labelIds = new Map<string, string>();

  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * One message of `action`: a whole message (upsert), its labels and
   * flags (labels), or its deletion (delete).
   *
   * @throws whatever the GraphQL client throws: the caller decides whether
   *   Hasura's answer makes the message worth retrying
   */
  async consume(
    input: unknown,
    action: MailMessageAction = "upsert",
  ): Promise<MailMessageOutcome> {
    if (action === "labels") return this.consumeLabels(input);
    if (action === "delete") return this.consumeDelete(input);
    return this.consumeUpsert(input);
  }

  private async consumeUpsert(input: unknown): Promise<MailMessageOutcome> {
    const converted = toMailMessageFields(input);
    if ("problems" in converted) {
      return { result: "invalid", problems: converted.problems };
    }
    const { message, recipients, attachments, labels } = converted.fields;
    if (!(await this.accountExists(message.accountId))) {
      return { result: "unknown_account" };
    }
    const labelIds = await this.labelIdsFor(message.accountId, labels);

    const write = gql`
      mutation WriteMailMessage(
        $message: minerva_mail_messages_insert_input!
        $snapshotTime: timestamptz!
      ) {
        insert_minerva_mail_messages_one(
          object: $message
          on_conflict: {
            constraint: mail_messages_account_id_gmail_id_key
            update_columns: [${MESSAGE_COLUMNS}]
            where: { snapshotTime: { _lte: $snapshotTime } }
          }
        ) {
          id
        }
      }
    `;
    const written = await this.graphQLClient.request<{
      insert_minerva_mail_messages_one: { id: string } | null;
    }>(write, { message, snapshotTime: message.snapshotTime });
    // Hasura answers null when the condition kept the newer row.
    const messageId = written.insert_minerva_mail_messages_one?.id;
    if (!messageId) return { result: "stale" };

    // Not in the same request as the message: a failure here is retried
    // whole, and writing the message again is harmless.
    const parts = gql`
      mutation WriteMailMessageParts(
        $messageId: uuid!
        $recipients: [minerva_mail_message_recipients_insert_input!]!
        $attachments: [minerva_mail_message_attachments_insert_input!]!
        $labels: [minerva_mail_message_labels_insert_input!]!
      ) {
        delete_minerva_mail_message_recipients(
          where: { messageId: { _eq: $messageId } }
        ) {
          affected_rows
        }
        delete_minerva_mail_message_attachments(
          where: { messageId: { _eq: $messageId } }
        ) {
          affected_rows
        }
        delete_minerva_mail_message_labels(
          where: { messageId: { _eq: $messageId } }
        ) {
          affected_rows
        }
        insert_minerva_mail_message_recipients(objects: $recipients) {
          affected_rows
        }
        insert_minerva_mail_message_attachments(objects: $attachments) {
          affected_rows
        }
        insert_minerva_mail_message_labels(objects: $labels) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(parts, {
      messageId,
      recipients: recipients.map((r) => ({ ...r, messageId })),
      attachments: attachments.map((a) => ({ ...a, messageId })),
      labels: labelIds.map((labelId) => ({ messageId, labelId })),
    });
    return { result: "written" };
  }

  /**
   * Gmail's labels and flags for a message Minerva has, replacing its own,
   * unless Minerva holds a newer snapshot. A message Minerva lacks is left
   * to its upsert: stale.
   */
  private async consumeLabels(input: unknown): Promise<MailMessageOutcome> {
    const converted = toMailLabelsFields(input);
    if ("problems" in converted) {
      return { result: "invalid", problems: converted.problems };
    }
    const f = converted.fields;
    if (!(await this.accountExists(f.accountId))) {
      return { result: "unknown_account" };
    }
    const labelIds = await this.labelIdsFor(f.accountId, f.labels);
    const update = gql`
      mutation WriteMailMessageLabels(
        $accountId: uuid!
        $gmailId: String!
        $snapshotTime: timestamptz!
        $flags: minerva_mail_messages_set_input!
      ) {
        update_minerva_mail_messages(
          where: {
            accountId: { _eq: $accountId }
            gmailId: { _eq: $gmailId }
            snapshotTime: { _lte: $snapshotTime }
          }
          _set: $flags
        ) {
          returning {
            id
          }
        }
      }
    `;
    const updated = await this.graphQLClient.request<{
      update_minerva_mail_messages: { returning: { id: string }[] };
    }>(update, {
      accountId: f.accountId,
      gmailId: f.gmailId,
      snapshotTime: f.snapshotTime,
      flags: { ...f.flags, snapshotTime: f.snapshotTime },
    });
    const messageId = updated.update_minerva_mail_messages.returning[0]?.id;
    if (!messageId) return { result: "stale" };
    const replace = gql`
      mutation ReplaceMailMessageLabels(
        $messageId: uuid!
        $labels: [minerva_mail_message_labels_insert_input!]!
      ) {
        delete_minerva_mail_message_labels(
          where: { messageId: { _eq: $messageId } }
        ) {
          affected_rows
        }
        insert_minerva_mail_message_labels(objects: $labels) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(replace, {
      messageId,
      labels: labelIds.map((labelId) => ({ messageId, labelId })),
    });
    return { result: "written" };
  }

  /** Forgets a message gone from Gmail, unless Minerva's is newer. */
  private async consumeDelete(input: unknown): Promise<MailMessageOutcome> {
    const converted = toMailDeleteFields(input);
    if ("problems" in converted) {
      return { result: "invalid", problems: converted.problems };
    }
    const f = converted.fields;
    const remove = gql`
      mutation DeleteMailMessage(
        $accountId: uuid!
        $gmailId: String!
        $snapshotTime: timestamptz!
      ) {
        delete_minerva_mail_messages(
          where: {
            accountId: { _eq: $accountId }
            gmailId: { _eq: $gmailId }
            snapshotTime: { _lte: $snapshotTime }
          }
        ) {
          affected_rows
        }
      }
    `;
    const deleted = await this.graphQLClient.request<{
      delete_minerva_mail_messages: { affected_rows: number };
    }>(remove, f);
    return deleted.delete_minerva_mail_messages.affected_rows > 0
      ? { result: "written" }
      : { result: "stale" };
  }

  private async accountExists(accountId: string): Promise<boolean> {
    if (this.accounts.has(accountId)) return true;
    const query = gql`
      query DescribeMailMessageAccount($accountId: uuid!) {
        minerva_mail_accounts_by_pk(id: $accountId) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts_by_pk: { id: string } | null;
    }>(query, { accountId });
    if (!response.minerva_mail_accounts_by_pk) return false;
    this.accounts.add(accountId);
    return true;
  }

  /** The labels' IDs, making those the account does not have yet. */
  private async labelIdsFor(
    accountId: string,
    labels: MailLabelRef[],
  ): Promise<string[]> {
    const key = (name: string) => `${accountId}\u0000${name}`;
    const missing = labels.filter((l) => !this.labelIds.has(key(l.name)));
    if (missing.length) {
      const ensure = gql`
        mutation EnsureMailLabels(
          $labels: [minerva_mail_labels_insert_input!]!
        ) {
          insert_minerva_mail_labels(
            objects: $labels
            on_conflict: {
              constraint: mail_labels_account_id_name_key
              update_columns: []
            }
          ) {
            affected_rows
          }
        }
      `;
      await this.graphQLClient.request(ensure, {
        labels: missing.map((l) => ({ accountId, name: l.name, type: l.type })),
      });
      const query = gql`
        query ListMailLabelIds($accountId: uuid!, $names: [String!]!) {
          minerva_mail_labels(
            where: { accountId: { _eq: $accountId }, name: { _in: $names } }
          ) {
            id
            name
          }
        }
      `;
      const response = await this.graphQLClient.request<{
        minerva_mail_labels: { id: string; name: string }[];
      }>(query, { accountId, names: missing.map((l) => l.name) });
      for (const label of response.minerva_mail_labels) {
        this.labelIds.set(key(label.name), label.id);
      }
    }
    return labels.flatMap((l) => {
      const id = this.labelIds.get(key(l.name));
      return id ? [id] : [];
    });
  }
}
