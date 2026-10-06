import { BadRequestException, Injectable } from "@nestjs/common";
import {
  GetMailAuditResponse,
  ListMailAuditChangesResponse,
  MailAuditAction,
  MailAuditChangeSort,
  MailAuditRule,
  RunMailAuditResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import { csvRow } from "../../../utils/csv";
import {
  GraphQlMailAuditChange,
  GraphQlMailAuditLabel,
  GraphQlMailAuditMerge,
  GraphQlMailAuditRun,
  GraphQlMailAuditSummary,
  GraphQlMailAuditThread,
  GraphQlMailStarAge,
  GraphQlMailStarLabel,
  GraphQlMailStarMixed,
  GraphQlMailStarSender,
  toChange,
  toLabel,
  toMerge,
  toRun,
  toStarAge,
  toStarLabel,
  toStarMixed,
  toStarSender,
  toSummary,
  toThread,
} from "../converters/MailAuditConverter";

/** The confidence at and above which a proposed change is high confidence. */
export const MAIL_AUDIT_HIGH_CONFIDENCE = 0.9;

/** How many of each list the Re-classification page shows. */
export const MAIL_AUDIT_TOP = {
  threads: 50,
  starLabels: 15,
  starSenders: 15,
  starMixed: 20,
};

/** The largest page of proposed changes a caller may ask for. */
export const MAIL_AUDIT_MAX_PAGE_SIZE = 200;

/** How many changes the export reads from Hasura at a time. */
export const MAIL_AUDIT_EXPORT_CHUNK = 5000;

/** The export's columns, in order. */
export const MAIL_AUDIT_EXPORT_COLUMNS = [
  "received_time",
  "gmail_id",
  "thread_id",
  "from_address",
  "from_name",
  "subject",
  "label",
  "action",
  "rule",
  "confidence",
  "sender_messages",
  "sender_label_messages",
  "ticked",
  "labels_now",
  "gmail_link",
];

export type MailAuditChangeFilters = {
  label?: string;
  action?: MailAuditAction;
  rule?: MailAuditRule;
  minConfidence?: number;
};

export type MailAuditChangeQuery = {
  label?: string;
  action?: MailAuditAction;
  rule?: MailAuditRule;
  minConfidence?: number;
  sortBy: MailAuditChangeSort;
  sort: SortDirection;
  pageSize: number;
  startPage: number;
};

const RUN_FIELDS = `
  id
  accountId
  startedTime
  finishedTime
  messagesExamined
  sendersExamined
  consistentSenders
`;

/**
 * The mail audit (docs/plans/email-management phase 2): rules over the
 * stored metadata that propose label changes, find threads whose messages
 * disagree and labels that may be one. A run is computed in SQL and kept,
 * so the page, its drill-down and the export read one set; stars are
 * counted live. Read-only towards Gmail: nothing here changes a label.
 */
@Injectable()
export class MailAuditService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Audits each of the user's accounts, replacing its last run. */
  async run(userId: string): Promise<RunMailAuditResponse> {
    const mutation = gql`
      mutation RunMailAudit($userId: uuid!) {
        minerva_mail_run_audit(args: { for_user: $userId }) {
          ${RUN_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_run_audit: GraphQlMailAuditRun[];
    }>(mutation, { userId });
    return { runs: response.minerva_mail_run_audit.map(toRun) };
  }

  /** The latest audit over the user's mail, with stars counted now. */
  async get(userId: string): Promise<GetMailAuditResponse> {
    const query = gql`
      query GetMailAudit(
        $userId: uuid!
        $high: numeric!
        $threads: Int!
        $starLabels: Int!
        $starSenders: Int!
        $starMixed: Int!
      ) {
        minerva_mail_audit_summary(args: { for_user: $userId, high: $high }) {
          startedTime
          finishedTime
          messagesExamined
          consistentSenders
          changes
          additions
          removals
          highConfidence
          messagesAffected
          merges
          threads
          classifierFinishedTime
          classifierChanges
        }
        minerva_mail_audit_labels(args: { for_user: $userId, high: $high }) {
          name
          messages
          lastReceivedTime
          proposedIn
          proposedOut
          highConfidence
          mergeCandidate
        }
        minerva_mail_audit_merges(
          where: { run: { account: { userId: { _eq: $userId } } } }
          order_by: [{ senderOverlap: desc }, { fromMessages: desc }]
        ) {
          reason
          sharedSenders
          fromSenders
          senderOverlap
          fromMessages
          intoMessages
          fromLastReceivedTime
          intoLastReceivedTime
          fromLabel {
            name
          }
          intoLabel {
            name
          }
        }
        minerva_mail_audit_threads(
          where: { run: { account: { userId: { _eq: $userId } } } }
          order_by: [{ messages: desc }, { lastReceivedTime: desc }]
          limit: $threads
        ) {
          threadId
          messages
          labelSets
          lastReceivedTime
        }
        minerva_mail_star_labels(
          args: { for_user: $userId, top: $starLabels }
        ) {
          name
          messages
          starred
        }
        minerva_mail_star_senders(
          args: { for_user: $userId, top: $starSenders }
        ) {
          address
          messages
          starred
        }
        minerva_mail_star_ages(args: { for_user: $userId }) {
          age
          starred
        }
        minerva_mail_star_mixed(args: { for_user: $userId, top: $starMixed }) {
          address
          subjectPattern
          messages
          starred
          lastReceivedTime
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_audit_summary: GraphQlMailAuditSummary[];
      minerva_mail_audit_labels: GraphQlMailAuditLabel[];
      minerva_mail_audit_merges: GraphQlMailAuditMerge[];
      minerva_mail_audit_threads: GraphQlMailAuditThread[];
      minerva_mail_star_labels: GraphQlMailStarLabel[];
      minerva_mail_star_senders: GraphQlMailStarSender[];
      minerva_mail_star_ages: GraphQlMailStarAge[];
      minerva_mail_star_mixed: GraphQlMailStarMixed[];
    }>(query, {
      userId,
      high: MAIL_AUDIT_HIGH_CONFIDENCE,
      threads: MAIL_AUDIT_TOP.threads,
      starLabels: MAIL_AUDIT_TOP.starLabels,
      starSenders: MAIL_AUDIT_TOP.starSenders,
      starMixed: MAIL_AUDIT_TOP.starMixed,
    });

    const summary = response.minerva_mail_audit_summary[0];
    return {
      highConfidence: MAIL_AUDIT_HIGH_CONFIDENCE,
      ...(summary ? { summary: toSummary(summary) } : {}),
      labels: response.minerva_mail_audit_labels.map(toLabel),
      merges: response.minerva_mail_audit_merges.map(toMerge),
      threads: response.minerva_mail_audit_threads.map(toThread),
      stars: {
        labels: response.minerva_mail_star_labels.map(toStarLabel),
        senders: response.minerva_mail_star_senders.map(toStarSender),
        ages: response.minerva_mail_star_ages.map(toStarAge),
        mixed: response.minerva_mail_star_mixed.map(toStarMixed),
      },
    };
  }

  /**
   * A page of the proposed changes over the user's mail: the latest
   * audit's and the classifier's latest published run's (mail_proposals).
   */
  async listChanges(
    userId: string,
    q: MailAuditChangeQuery,
  ): Promise<ListMailAuditChangesResponse> {
    if (q.pageSize < 1 || q.pageSize > MAIL_AUDIT_MAX_PAGE_SIZE) {
      throw new BadRequestException(
        `pageSize must be from 1 to ${MAIL_AUDIT_MAX_PAGE_SIZE}`,
      );
    }
    if (q.startPage < 0) {
      throw new BadRequestException("startPage must not be negative");
    }
    const page = await this.fetchChanges(
      this.changesWhere(userId, q),
      this.changesOrder(q.sortBy, q.sort),
      q.pageSize,
      q.pageSize * q.startPage,
    );
    return { count: page.count, changes: page.changes.map(toChange) };
  }

  /**
   * Every one of the latest audit's proposed changes over the user's mail
   * that `filters` admit, as CSV: a header, then a row per change, most
   * confident first. Metadata only, as stored; never message text.
   */
  async exportChanges(
    userId: string,
    filters: MailAuditChangeFilters,
  ): Promise<string> {
    const where = this.changesWhere(userId, filters);
    const orderBy = this.changesOrder(
      MailAuditChangeSort.Confidence,
      SortDirection.DESC,
    );
    let csv = csvRow(MAIL_AUDIT_EXPORT_COLUMNS);
    for (let offset = 0; ; offset += MAIL_AUDIT_EXPORT_CHUNK) {
      const page = await this.fetchChanges(
        where,
        orderBy,
        MAIL_AUDIT_EXPORT_CHUNK,
        offset,
      );
      for (const change of page.changes.map(toChange)) {
        const m = change.message;
        csv += csvRow([
          m.receivedTime.toISOString(),
          m.gmailId,
          m.threadId,
          m.fromAddress,
          m.fromName,
          m.subject,
          change.label,
          change.action,
          change.rule,
          change.confidence,
          change.senderMessages,
          change.senderLabelMessages,
          change.ticked === undefined ? undefined : String(change.ticked),
          m.labels.join("; "),
          `https://mail.google.com/mail/u/0/#all/${m.gmailId}`,
        ]);
      }
      if (page.changes.length < MAIL_AUDIT_EXPORT_CHUNK) return csv;
    }
  }

  private changesWhere(
    userId: string,
    f: MailAuditChangeFilters,
  ): Record<string, unknown> {
    if (f.label !== undefined && (f.label.length < 1 || f.label.length > 225)) {
      throw new BadRequestException("label must be 1 to 225 characters");
    }
    if (
      f.minConfidence !== undefined &&
      !(f.minConfidence >= 0 && f.minConfidence <= 1)
    ) {
      throw new BadRequestException("minConfidence must be from 0 to 1");
    }
    return {
      account: { userId: { _eq: userId } },
      ...(f.label !== undefined ? { label: { name: { _eq: f.label } } } : {}),
      ...(f.action !== undefined ? { action: { _eq: f.action } } : {}),
      ...(f.rule !== undefined ? { rule: { _eq: f.rule } } : {}),
      ...(f.minConfidence !== undefined
        ? { confidence: { _gte: f.minConfidence } }
        : {}),
    };
  }

  private changesOrder(
    sortBy: MailAuditChangeSort,
    sort: SortDirection,
  ): Record<string, unknown>[] {
    return sortBy === MailAuditChangeSort.Confidence
      ? [
          { confidence: sort },
          { message: { receivedTime: "desc" } },
          { messageId: "asc" },
        ]
      : [
          { message: { receivedTime: sort } },
          { confidence: "desc" },
          { messageId: "asc" },
        ];
  }

  private async fetchChanges(
    where: Record<string, unknown>,
    orderBy: Record<string, unknown>[],
    limit: number,
    offset: number,
  ): Promise<{ count: number; changes: GraphQlMailAuditChange[] }> {
    const query = gql`
      query ListMailAuditChanges(
        $where: minerva_mail_proposals_bool_exp!
        $orderBy: [minerva_mail_proposals_order_by!]!
        $limit: Int!
        $offset: Int!
      ) {
        minerva_mail_proposals(
          where: $where
          order_by: $orderBy
          limit: $limit
          offset: $offset
        ) {
          action
          rule
          confidence
          senderMessages
          senderLabelMessages
          ticked
          label {
            name
          }
          message {
            gmailId
            threadId
            receivedTime
            fromAddress
            fromName
            subject
            messageLabels {
              label {
                name
                type
              }
            }
          }
        }
        minerva_mail_proposals_aggregate(where: $where) {
          aggregate {
            count
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_proposals: GraphQlMailAuditChange[];
      minerva_mail_proposals_aggregate: { aggregate: { count: number } };
    }>(query, { where, orderBy, limit, offset });
    return {
      count: response.minerva_mail_proposals_aggregate.aggregate.count,
      changes: response.minerva_mail_proposals,
    };
  }
}
