import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ListMailInboxToScoreResponse,
  ListMailTrainingDecisionsResponse,
  ListMailTrainingExamplesResponse,
  ListMailTrainingLabelsResponse,
  MailLabelKind,
  MailTrainingAccount,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  GraphQlMailTrainingAccount,
  GraphQlMailTrainingFamily,
  GraphQlMailTrainingMessage,
  toTrainingAccount,
  toTrainingExample,
  toTrainingFamily,
} from "../converters/MailTrainingConverter";

export const MAX_TRAINING_PAGE = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;

const TARGET_FIELDS = `
  name
  kind
  family {
    name
  }
`;

/** A message's labels as targets, and what was decided in the inbox. */
const EXAMPLE_LABELS = `
  messageLabels {
    label {
      ${TARGET_FIELDS}
      mergeTarget {
        ${TARGET_FIELDS}
      }
    }
  }
  inboxDecision {
    decision
    amended
  }
`;

/** Pages of decisions, and the inbox to score, at most this many. */
export const MAX_DECISION_PAGE = 1000;
export const MAX_INBOX_TO_SCORE = 5000;

/** A decision's place in the order: its time and message, opaque. */
const encodeCursor = (decidedTime: string, messageId: string): string =>
  Buffer.from(`${decidedTime}|${messageId}`).toString("base64url");

const decodeCursor = (
  cursor: string,
): { decidedTime: string; messageId: string } => {
  const [decidedTime, messageId] = Buffer.from(cursor, "base64url")
    .toString()
    .split("|");
  if (
    !decidedTime ||
    Number.isNaN(Date.parse(decidedTime)) ||
    !messageId ||
    !UUID.test(messageId)
  ) {
    throw new BadRequestException("after must be a decision's cursor");
  }
  return { decidedTime, messageId };
};

/**
 * What the classifier learns from (ADR 0030, Label kinds; docs/plans/
 * email-management phase 3): every account, each message's metadata with
 * its labels as training targets, and the labels it can suggest. For the
 * classifier service only, which reads across users; no message text, and
 * not even the snippet, leaves here (the text comes from the archive).
 */
@Injectable()
export class MailTrainingService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  async listAccounts(): Promise<MailTrainingAccount[]> {
    const query = gql`
      query ListMailTrainingAccounts {
        minerva_mail_accounts(order_by: { email: asc }) {
          id
          email
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts: GraphQlMailTrainingAccount[];
    }>(query);
    return response.minerva_mail_accounts.map(toTrainingAccount);
  }

  /**
   * A page of an account's messages, by Gmail ID after the cursor.
   *
   * @throws BadRequestException a parameter is not what it should be
   * @throws NotFoundException no such account
   */
  async listExamples(
    accountId: string | undefined,
    after: string | undefined,
    limit: number,
  ): Promise<ListMailTrainingExamplesResponse> {
    const account = requireAccountId(accountId);
    if (after !== undefined && !GMAIL_ID.test(after)) {
      throw new BadRequestException("after must be a Gmail message ID");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TRAINING_PAGE) {
      throw new BadRequestException(
        `limit must be between 1 and ${MAX_TRAINING_PAGE}`,
      );
    }
    await this.requireAccount(account);

    const query = gql`
      query ListMailTrainingExamples(
        $where: minerva_mail_messages_bool_exp!
        $limit: Int!
      ) {
        minerva_mail_messages(
          where: $where
          order_by: { gmailId: asc }
          limit: $limit
        ) {
          gmailId
          threadId
          receivedTime
          fromAddress
          listId
          sent
          ${EXAMPLE_LABELS}
        }
      }
    `;
    const where = {
      accountId: { _eq: account },
      ...(after !== undefined ? { gmailId: { _gt: after } } : {}),
    };
    const response = await this.graphQLClient.request<{
      minerva_mail_messages: GraphQlMailTrainingMessage[];
    }>(query, { where, limit });
    const messages = response.minerva_mail_messages;
    return {
      examples: messages.map(toTrainingExample),
      nextCursor:
        messages.length === limit
          ? messages[messages.length - 1].gmailId
          : undefined,
    };
  }

  /**
   * The account's approvals in the inbox in the order they were made (by
   * time, then message), after the cursor, each with its message as a
   * training example and whether its labels are settled: the batch writing
   * them has finished, or there was none. Skips are left out: they say
   * nothing about labels.
   *
   * @throws BadRequestException a parameter is not what it should be
   * @throws NotFoundException no such account
   */
  async listDecisions(
    accountId: string | undefined,
    after: string | undefined,
    limit: number,
  ): Promise<ListMailTrainingDecisionsResponse> {
    const account = requireAccountId(accountId);
    const from = after !== undefined ? decodeCursor(after) : undefined;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DECISION_PAGE) {
      throw new BadRequestException(
        `limit must be between 1 and ${MAX_DECISION_PAGE}`,
      );
    }
    await this.requireAccount(account);
    const query = gql`
      query ListMailTrainingDecisions(
        $where: minerva_mail_inbox_decisions_bool_exp!
        $limit: Int!
      ) {
        minerva_mail_inbox_decisions(
          where: $where
          order_by: [{ decidedTime: asc }, { messageId: asc }]
          limit: $limit
        ) {
          messageId
          decidedTime
          batch {
            status
          }
          message {
            gmailId
            threadId
            receivedTime
            fromAddress
            listId
            sent
            ${EXAMPLE_LABELS}
          }
        }
      }
    `;
    const where = {
      accountId: { _eq: account },
      decision: { _eq: "approved" },
      ...(from
        ? {
            _or: [
              { decidedTime: { _gt: from.decidedTime } },
              {
                decidedTime: { _eq: from.decidedTime },
                messageId: { _gt: from.messageId },
              },
            ],
          }
        : {}),
    };
    const rows = (
      await this.graphQLClient.request<{
        minerva_mail_inbox_decisions: {
          messageId: string;
          decidedTime: string;
          batch: { status: string } | null;
          message: GraphQlMailTrainingMessage;
        }[];
      }>(query, { where, limit })
    ).minerva_mail_inbox_decisions;
    const decisions = rows.map((r) => ({
      example: toTrainingExample(r.message),
      decidedTime: moment(r.decidedTime),
      ready:
        !r.batch || r.batch.status === "done" || r.batch.status === "failed",
      cursor: encodeCursor(r.decidedTime, r.messageId),
    }));
    return {
      decisions,
      ...(rows.length === limit
        ? { nextCursor: decisions[decisions.length - 1].cursor }
        : {}),
    };
  }

  /**
   * The account's messages to review in the inbox, newest first, for the
   * classifier to score again with a newer model.
   *
   * @throws BadRequestException accountId is not an ID
   * @throws NotFoundException no such account
   */
  async listInboxToScore(
    accountId: string | undefined,
  ): Promise<ListMailInboxToScoreResponse> {
    const account = requireAccountId(accountId);
    await this.requireAccount(account);
    const query = gql`
      query ListMailInboxToScore($accountId: uuid!, $limit: Int!) {
        minerva_mail_inbox(
          where: {
            accountId: { _eq: $accountId }
            inInbox: { _eq: true }
            decision: { _is_null: true }
          }
          order_by: { receivedTime: desc }
          limit: $limit
        ) {
          gmailId
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_inbox: { gmailId: string }[];
    }>(query, { accountId: account, limit: MAX_INBOX_TO_SCORE });
    return { gmailIds: response.minerva_mail_inbox.map((m) => m.gmailId) };
  }

  /**
   * The account's topical labels and state families.
   *
   * @throws BadRequestException accountId is not an ID
   * @throws NotFoundException no such account
   */
  async listLabels(
    accountId: string | undefined,
  ): Promise<ListMailTrainingLabelsResponse> {
    const account = requireAccountId(accountId);
    const query = gql`
      query ListMailTrainingLabels($accountId: uuid!, $topical: String!) {
        minerva_mail_accounts_by_pk(id: $accountId) {
          id
        }
        minerva_mail_labels(
          where: { accountId: { _eq: $accountId }, kind: { _eq: $topical } }
          order_by: { name: asc }
        ) {
          name
        }
        minerva_mail_label_families(
          where: { accountId: { _eq: $accountId } }
          order_by: { name: asc }
        ) {
          name
          initialLabel {
            name
          }
          states {
            name
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts_by_pk: { id: string } | null;
      minerva_mail_labels: { name: string }[];
      minerva_mail_label_families: GraphQlMailTrainingFamily[];
    }>(query, { accountId: account, topical: MailLabelKind.Topical });
    if (!response.minerva_mail_accounts_by_pk) {
      throw new NotFoundException(`No mail account ${account}`);
    }
    return {
      topics: response.minerva_mail_labels.map((l) => l.name),
      families: response.minerva_mail_label_families.map(toTrainingFamily),
    };
  }

  private async requireAccount(accountId: string): Promise<void> {
    const query = gql`
      query DescribeMailTrainingAccount($accountId: uuid!) {
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

const requireAccountId = (value: string | undefined): string => {
  if (value === undefined || !UUID.test(value)) {
    throw new BadRequestException("accountId must be a mail account ID");
  }
  return value;
};
