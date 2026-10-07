import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AcceptMailPaymentMatchesRequest,
  AcceptMailPaymentMatchesResponse,
  DismissMailPaymentMatchesRequest,
  MailLabelChange,
  MailPaymentExample,
  RecordMailPaymentScoresRequest,
  RecordMailPaymentScoresResponse,
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
import { MailChangeService } from "./MailChangeService";

export const MAX_PAYMENT_PAGE = 500;
export const MAX_PAYMENT_PAIRS = 1000;
export const MAX_PAYMENT_SCORES = 5000;
/** The most bills given the classifier as examples of what is not paid. */
const MAX_BILL_EXAMPLES = 20000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;

type Count = { aggregate: { count: number } };

const requirePairs = (
  pairs: unknown,
): { confirmationGmailId: string; billGmailId: string }[] => {
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
  return pairs as { confirmationGmailId: string; billGmailId: string }[];
};

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
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly changes: MailChangeService,
  ) {}

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
            fromName
            snippet
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
        message: {
          subject: string | null;
          fromAddress: string | null;
          fromName: string | null;
          snippet: string;
        };
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
        ...(b.message.fromName ? { fromName: b.message.fromName } : {}),
        ...(b.message.subject ? { subject: b.message.subject } : {}),
        snippet: b.message.snippet,
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
    const pairs = requirePairs(request?.pairs);
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

  /**
   * Approves matches: each bill still matched with its payment moves
   * along its transition, in one change batch, and the match is kept as
   * an example for the classifier. A pair no longer matched is left out.
   *
   * @throws NotFoundException the account is not the user's
   */
  async accept(
    userId: string,
    accountId: string,
    request: AcceptMailPaymentMatchesRequest,
  ): Promise<AcceptMailPaymentMatchesResponse> {
    if (typeof accountId !== "string" || !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a mail account ID");
    }
    const pairs = requirePairs(request?.pairs);
    const query = gql`
      query DescribeMailPaymentAcceptance(
        $accountId: uuid!
        $userId: uuid!
        $confirmations: [String!]!
      ) {
        minerva_mail_accounts(
          where: { id: { _eq: $accountId }, userId: { _eq: $userId } }
        ) {
          id
        }
        minerva_mail_payment_matches(
          where: {
            accountId: { _eq: $accountId }
            confirmationGmailId: { _in: $confirmations }
          }
        ) {
          confirmationId
          confirmationGmailId
          billId
          billGmailId
          fromLabel
          toLabel
        }
      }
    `;
    const found = await this.graphQLClient.request<{
      minerva_mail_accounts: { id: string }[];
      minerva_mail_payment_matches: {
        confirmationId: string;
        confirmationGmailId: string;
        billId: string;
        billGmailId: string;
        fromLabel: string;
        toLabel: string;
      }[];
    }>(query, {
      accountId,
      userId,
      confirmations: [...new Set(pairs.map((p) => p.confirmationGmailId))],
    });
    if (!found.minerva_mail_accounts.length) {
      throw new NotFoundException(`No mail account ${accountId}`);
    }
    const wanted = new Set(
      pairs.map((p) => `${p.confirmationGmailId}:${p.billGmailId}`),
    );
    const matches = found.minerva_mail_payment_matches.filter((m) =>
      wanted.has(`${m.confirmationGmailId}:${m.billGmailId}`),
    );
    if (!matches.length) return { accepted: 0 };
    const byBill = new Map<string, MailLabelChange>();
    for (const m of matches) {
      byBill.set(m.billGmailId, {
        gmailId: m.billGmailId,
        add: [m.toLabel],
        remove: [m.fromLabel],
      });
    }
    const batch = await this.changes.apply(userId, accountId, {
      changes: [...byBill.values()],
    });
    const mutation = gql`
      mutation AcceptMailPaymentMatches(
        $rows: [minerva_mail_payment_acceptances_insert_input!]!
      ) {
        insert_minerva_mail_payment_acceptances(
          objects: $rows
          on_conflict: {
            constraint: mail_payment_acceptances_pkey
            update_columns: [batchId]
          }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      rows: matches.map((m) => ({
        confirmationId: m.confirmationId,
        billId: m.billId,
        batchId: batch.id,
        userId,
      })),
    });
    return { accepted: matches.length, batch };
  }

  /**
   * What the classifier learns payments from (agents only): the payments
   * of matches approved; the messages of matches declined, never approved;
   * and the bills (every message in a state), which share a payment's
   * sender and much of its wording.
   */
  async examples(accountId: string): Promise<MailPaymentExample[]> {
    if (typeof accountId !== "string" || !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a mail account ID");
    }
    const query = gql`
      query ListMailPaymentExamples($accountId: uuid!, $bills: Int!) {
        accepted: minerva_mail_payment_acceptances(
          where: { confirmation: { accountId: { _eq: $accountId } } }
        ) {
          confirmation {
            gmailId
          }
        }
        declined: minerva_mail_payment_dismissals(
          where: { confirmation: { accountId: { _eq: $accountId } } }
        ) {
          confirmation {
            gmailId
          }
        }
        bills: minerva_mail_messages(
          where: {
            accountId: { _eq: $accountId }
            messageLabels: { label: { kind: { _eq: "state" } } }
          }
          order_by: { receivedTime: desc }
          limit: $bills
        ) {
          gmailId
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      accepted: { confirmation: { gmailId: string } }[];
      declined: { confirmation: { gmailId: string } }[];
      bills: { gmailId: string }[];
    }>(query, { accountId, bills: MAX_BILL_EXAMPLES });
    const payments = new Set(
      response.accepted.map((a) => a.confirmation.gmailId),
    );
    const not = new Set(
      [
        ...response.declined.map((d) => d.confirmation.gmailId),
        ...response.bills.map((b) => b.gmailId),
      ].filter((g) => !payments.has(g)),
    );
    return [
      ...[...payments].sort().map((gmailId) => ({ gmailId, payment: true })),
      ...[...not].sort().map((gmailId) => ({ gmailId, payment: false })),
    ];
  }

  /**
   * Stores a batch of the classifier's payment scores (agents only); the
   * first batch of a run drops the account's scores before. A message the
   * account does not have is left out and counted.
   *
   * @throws NotFoundException no such account
   */
  async recordScores(
    accountId: string,
    request: RecordMailPaymentScoresRequest,
  ): Promise<RecordMailPaymentScoresResponse> {
    if (typeof accountId !== "string" || !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a mail account ID");
    }
    const scores = request?.scores;
    if (
      !Array.isArray(scores) ||
      scores.length > MAX_PAYMENT_SCORES ||
      !scores.every(
        (s) =>
          s &&
          typeof s.gmailId === "string" &&
          GMAIL_ID.test(s.gmailId) &&
          typeof s.score === "number" &&
          s.score >= 0 &&
          s.score <= 1,
      )
    ) {
      throw new BadRequestException(
        `scores must be at most ${MAX_PAYMENT_SCORES} Gmail IDs, each with a score from 0 to 1`,
      );
    }
    if (typeof request.first !== "boolean") {
      throw new BadRequestException("first must be true or false");
    }
    const query = gql`
      query DescribeMailPaymentScoreTargets(
        $accountId: uuid!
        $gmailIds: [String!]!
      ) {
        minerva_mail_accounts_by_pk(id: $accountId) {
          id
          messages(where: { gmailId: { _in: $gmailIds } }) {
            gmailId
          }
        }
      }
    `;
    const found = await this.graphQLClient.request<{
      minerva_mail_accounts_by_pk: {
        id: string;
        messages: { gmailId: string }[];
      } | null;
    }>(query, {
      accountId,
      gmailIds: [...new Set(scores.map((s) => s.gmailId))],
    });
    const account = found.minerva_mail_accounts_by_pk;
    if (!account) throw new NotFoundException(`No mail account ${accountId}`);
    const known = new Set(account.messages.map((m) => m.gmailId));
    const rows = new Map(
      scores
        .filter((s) => known.has(s.gmailId))
        .map((s) => [
          s.gmailId,
          {
            accountId,
            gmailId: s.gmailId,
            score: Math.round(s.score * 1000) / 1000,
            scoredTime: new Date().toISOString(),
          },
        ]),
    );
    // The first batch replaces the account's scores, in one transaction.
    const mutation = request.first
      ? gql`
          mutation ReplaceMailPaymentScores(
            $accountId: uuid!
            $rows: [minerva_mail_payment_scores_insert_input!]!
          ) {
            delete_minerva_mail_payment_scores(
              where: { accountId: { _eq: $accountId } }
            ) {
              affected_rows
            }
            insert_minerva_mail_payment_scores(objects: $rows) {
              affected_rows
            }
          }
        `
      : gql`
          mutation RecordMailPaymentScores(
            $rows: [minerva_mail_payment_scores_insert_input!]!
          ) {
            insert_minerva_mail_payment_scores(
              objects: $rows
              on_conflict: {
                constraint: mail_payment_scores_pkey
                update_columns: [score, scoredTime]
              }
            ) {
              affected_rows
            }
          }
        `;
    await this.graphQLClient.request(mutation, {
      ...(request.first ? { accountId } : {}),
      rows: [...rows.values()],
    });
    return { recorded: rows.size, skipped: scores.length - rows.size };
  }
}
