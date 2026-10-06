import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ListMailTrainingExamplesResponse,
  ListMailTrainingLabelsResponse,
  MailLabelKind,
  MailTrainingAccount,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
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
          messageLabels {
            label {
              ${TARGET_FIELDS}
              mergeTarget {
                ${TARGET_FIELDS}
              }
            }
          }
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
