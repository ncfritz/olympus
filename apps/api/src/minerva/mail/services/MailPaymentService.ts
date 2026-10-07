import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DismissMailPaymentMatchesRequest,
  ListMailOpenBillsResponse,
  ListMailPaymentMatchesResponse,
  MailStarIcon,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  type GraphQlPaymentMatch,
  PAYMENT_MATCH_FIELDS,
  toPaymentMatch,
} from "../converters/MailPaymentConverter";

export const MAX_PAYMENT_PAGE = 500;
export const MAX_PAYMENT_PAIRS = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;

type Count = { aggregate: { count: number } };

const page = (offset: number, limit: number, max: number): void => {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new BadRequestException("offset must not be negative");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    throw new BadRequestException(`limit must be between 1 and ${max}`);
  }
};

const accountFilter = (accountId?: string) => {
  if (accountId !== undefined && !UUID.test(accountId)) {
    throw new BadRequestException("accountId must be an ID");
  }
  return accountId ? { accountId: { _eq: accountId } } : {};
};

/**
 * Transitions from payments (docs/plans/email-management phase 7 step
 * 2): payment confirmations matched to the open bills they pay
 * (`mail_payment_matches`, computed on read), the open bills by age
 * (`mail_open_states`), and pairs declined. Moving a bill is an ordinary
 * change batch; metadata only.
 */
@Injectable()
export class MailPaymentService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * A page of the user's matches, newest confirmation first; with
   * `inInbox`, only those whose confirmation is (or is not) in the inbox.
   */
  async matches(
    userId: string,
    query: {
      accountId?: string;
      inInbox?: boolean;
      offset: number;
      limit: number;
    },
  ): Promise<ListMailPaymentMatchesResponse> {
    page(query.offset, query.limit, MAX_PAYMENT_PAGE);
    const where = {
      account: { userId: { _eq: userId } },
      ...accountFilter(query.accountId),
      ...(query.inInbox !== undefined
        ? { confirmationInInbox: { _eq: query.inInbox } }
        : {}),
    };
    const listQuery = gql`
      query ListMailPaymentMatches(
        $where: minerva_mail_payment_matches_bool_exp!
        $offset: Int!
        $limit: Int!
      ) {
        minerva_mail_payment_matches(
          where: $where
          order_by: [{ confirmedTime: desc }, { confirmationGmailId: asc }]
          offset: $offset
          limit: $limit
        ) {
          ${PAYMENT_MATCH_FIELDS}
        }
        count: minerva_mail_payment_matches_aggregate(where: $where) {
          aggregate {
            count
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_payment_matches: GraphQlPaymentMatch[];
      count: Count;
    }>(listQuery, { where, offset: query.offset, limit: query.limit });
    return {
      matches: response.minerva_mail_payment_matches.map(toPaymentMatch),
      count: response.count.aggregate.count,
    };
  }

  /** A page of the user's open bills, oldest first, and their ages. */
  async openBills(
    userId: string,
    query: { accountId?: string; offset: number; limit: number },
    now = moment(),
  ): Promise<ListMailOpenBillsResponse> {
    page(query.offset, query.limit, MAX_PAYMENT_PAGE);
    const base = {
      account: { userId: { _eq: userId } },
      ...accountFilter(query.accountId),
    };
    const month = now.clone().subtract(30, "days").toISOString();
    const quarter = now.clone().subtract(90, "days").toISOString();
    const listQuery = gql`
      query ListMailOpenBills(
        $base: minerva_mail_open_states_bool_exp!
        $month: timestamptz!
        $quarter: timestamptz!
        $offset: Int!
        $limit: Int!
      ) {
        minerva_mail_open_states(
          where: $base
          order_by: [{ receivedTime: asc }, { gmailId: asc }]
          offset: $offset
          limit: $limit
        ) {
          accountId
          gmailId
          receivedTime
          label
          toLabel
          starred
          starIcon
          message {
            subject
            fromAddress
          }
        }
        count: minerva_mail_open_states_aggregate(where: $base) {
          aggregate {
            count
          }
        }
        month: minerva_mail_open_states_aggregate(
          where: { _and: [$base, { receivedTime: { _gte: $month } }] }
        ) {
          aggregate {
            count
          }
        }
        older: minerva_mail_open_states_aggregate(
          where: { _and: [$base, { receivedTime: { _lt: $quarter } }] }
        ) {
          aggregate {
            count
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_open_states: {
        accountId: string;
        gmailId: string;
        receivedTime: string;
        label: string;
        toLabel: string | null;
        starred: boolean;
        starIcon: string | null;
        message: { subject: string | null; fromAddress: string | null };
      }[];
      count: Count;
      month: Count;
      older: Count;
    }>(listQuery, {
      base,
      month,
      quarter,
      offset: query.offset,
      limit: query.limit,
    });
    const count = response.count.aggregate.count;
    const recent = response.month.aggregate.count;
    const older = response.older.aggregate.count;
    return {
      bills: response.minerva_mail_open_states.map((b) => ({
        accountId: b.accountId,
        gmailId: b.gmailId,
        ...(b.message.fromAddress
          ? { fromAddress: b.message.fromAddress }
          : {}),
        ...(b.message.subject ? { subject: b.message.subject } : {}),
        receivedTime: moment(b.receivedTime),
        label: b.label,
        ...(b.toLabel ? { toLabel: b.toLabel } : {}),
        starred: b.starred,
        ...(b.starIcon ? { starIcon: b.starIcon as MailStarIcon } : {}),
      })),
      count,
      ages: { month: recent, quarter: count - recent - older, older },
    };
  }

  /**
   * Records pairs as not a bill and its payment: the confirmation is then
   * matched with the open bill before, if any.
   *
   * @throws NotFoundException the account is not the user's
   */
  async dismiss(
    userId: string,
    accountId: string,
    request: DismissMailPaymentMatchesRequest,
  ): Promise<number> {
    if (typeof accountId !== "string" || !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a mail account ID");
    }
    const pairs = request?.pairs;
    if (
      !Array.isArray(pairs) ||
      pairs.length < 1 ||
      pairs.length > MAX_PAYMENT_PAIRS ||
      !pairs.every(
        (p) =>
          p &&
          typeof p.confirmationGmailId === "string" &&
          GMAIL_ID.test(p.confirmationGmailId) &&
          typeof p.billGmailId === "string" &&
          GMAIL_ID.test(p.billGmailId),
      )
    ) {
      throw new BadRequestException(
        `pairs must be 1 to ${MAX_PAYMENT_PAIRS} pairs of Gmail message IDs`,
      );
    }
    const gmailIds = [
      ...new Set(pairs.flatMap((p) => [p.confirmationGmailId, p.billGmailId])),
    ];
    const query = gql`
      query DescribeMailPaymentMessages(
        $accountId: uuid!
        $userId: uuid!
        $gmailIds: [String!]!
      ) {
        minerva_mail_accounts(
          where: { id: { _eq: $accountId }, userId: { _eq: $userId } }
        ) {
          id
          messages(where: { gmailId: { _in: $gmailIds } }) {
            id
            gmailId
          }
        }
      }
    `;
    const found = await this.graphQLClient.request<{
      minerva_mail_accounts: {
        id: string;
        messages: { id: string; gmailId: string }[];
      }[];
    }>(query, { accountId, userId, gmailIds });
    const account = found.minerva_mail_accounts[0];
    if (!account) throw new NotFoundException(`No mail account ${accountId}`);
    const ids = new Map(account.messages.map((m) => [m.gmailId, m.id]));
    const rows = pairs.flatMap((p) => {
      const confirmationId = ids.get(p.confirmationGmailId);
      const billId = ids.get(p.billGmailId);
      return confirmationId && billId ? [{ confirmationId, billId }] : [];
    });
    if (!rows.length) return 0;
    const mutation = gql`
      mutation DismissMailPaymentMatches(
        $rows: [minerva_mail_payment_dismissals_insert_input!]!
      ) {
        insert_minerva_mail_payment_dismissals(
          objects: $rows
          on_conflict: {
            constraint: mail_payment_dismissals_pkey
            update_columns: []
          }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, { rows });
    return rows.length;
  }
}
