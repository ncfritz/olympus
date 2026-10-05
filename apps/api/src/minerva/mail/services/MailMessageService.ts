import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  type MailLabelRef,
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
   * @throws whatever the GraphQL client throws: the caller decides whether
   *   Hasura's answer makes the message worth retrying
   */
  async consume(input: unknown): Promise<MailMessageOutcome> {
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
