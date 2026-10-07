import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApproveMailMessagesRequest,
  ApproveMailMessagesResponse,
  ListMailInboxResponse,
  MailMessageContent,
  MailInboxDecision,
  MailInboxMessage,
  MailInboxSort,
  SortDirection,
  MailInboxStatus,
  MailInboxSummary,
  MailLabelChange,
  MailStarIcon,
  SkipMailMessagesRequest,
  SkipMailMessagesResponse,
  UpdateMailMessageFlagsRequest,
  UpdateMailMessageFlagsResponse,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  type GraphQlPaymentMatch,
  PAYMENT_MATCH_FIELDS,
  toPaymentMatch,
} from "../converters/MailPaymentConverter";
import { MAIL_FLAG_LABELS, MailChangeService } from "./MailChangeService";
import { MinervaMailAgentClient } from "./MinervaMailAgentClient";

/** Messages an inbox action takes at once. */
export const MAX_INBOX_MESSAGES = 500;
export const MAIL_INBOX_MAX_PAGE_SIZE = 100;
/** A suggestion this sure or more is high confidence. */
export const MAIL_INBOX_HIGH = 0.9;
/** Approved since a day ago, unless the caller says since when. */
const DEFAULT_APPROVED_HOURS = 24;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;

/** A term as an ILIKE pattern that contains it, its wildcards escaped. */
const likePattern = (term?: string): string | undefined => {
  const t = term?.trim();
  return t ? `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;
};

export type MailInboxQuery = {
  status: MailInboxStatus;
  accountId?: string;
  search?: string;
  /** Only those whose sender's name or address contains this. */
  from?: string;
  /** Only those whose subject contains this. */
  subject?: string;
  minConfidence?: number;
  /** When "approved" begins; a day ago by default. */
  approvedSince?: string;
  sortBy: MailInboxSort;
  /** Descending unless asked; asc or desc only, nulls always last. */
  sort?: SortDirection;
  pageSize: number;
  startPage: number;
};

type GraphQlInboxRow = {
  accountId: string;
  gmailId: string;
  threadId: string;
  threadSize: number;
  receivedTime: string;
  inInbox: boolean;
  unread: boolean;
  scoredTime: string | null;
  topScore: number | string | null;
  decision: string | null;
  decidedTime: string | null;
  amended: boolean | null;
  message: {
    fromName: string | null;
    fromAddress: string | null;
    subject: string | null;
    snippet: string;
    starred: boolean;
    starIcon: string | null;
    messageLabels: { label: { name: string; type: string } }[];
    score: {
      suggestions: {
        rank: number;
        score: number | string;
        ticked: boolean;
        label: { name: string };
      }[];
    } | null;
  };
  payment: GraphQlPaymentMatch | null;
};

/** A message an action touches, as Minerva has it. */
type GraphQlTarget = {
  id: string;
  gmailId: string;
  threadId: string;
  inInbox: boolean;
  unread: boolean;
  messageLabels: { label: { name: string; type: string } }[];
  score: {
    modelRun: string;
    suggestions: { ticked: boolean; label: { name: string } }[];
  } | null;
};

const TARGET_FIELDS = `
  id
  gmailId
  threadId
  inInbox
  unread
  messageLabels {
    label {
      name
      type
    }
  }
  score {
    modelRun
    suggestions {
      ticked
      label {
        name
      }
    }
  }
`;

const userLabels = (m: {
  messageLabels: { label: { name: string; type: string } }[];
}): string[] =>
  m.messageLabels
    .filter((l) => l.label.type === "user")
    .map((l) => l.label.name)
    .sort();

const toMessage = (r: GraphQlInboxRow): MailInboxMessage => {
  const labels = userLabels(r.message);
  const suggestions = [...(r.message.score?.suggestions ?? [])]
    .sort((a, b) => a.rank - b.rank)
    .map((s) => ({
      label: s.label.name,
      score: Number(s.score),
      ticked: s.ticked,
      onMessage: labels.includes(s.label.name),
    }));
  return {
    accountId: r.accountId,
    gmailId: r.gmailId,
    threadId: r.threadId,
    threadSize: r.threadSize,
    ...(r.message.fromName ? { fromName: r.message.fromName } : {}),
    ...(r.message.fromAddress ? { fromAddress: r.message.fromAddress } : {}),
    ...(r.message.subject ? { subject: r.message.subject } : {}),
    snippet: r.message.snippet,
    receivedTime: moment(r.receivedTime),
    inInbox: r.inInbox,
    unread: r.unread,
    starred: r.message.starred,
    ...(r.message.starIcon
      ? { starIcon: r.message.starIcon as MailStarIcon }
      : {}),
    labels,
    suggestions,
    ...(r.scoredTime ? { scoredTime: moment(r.scoredTime) } : {}),
    ...(r.topScore !== null ? { topScore: Number(r.topScore) } : {}),
    ...(r.decision ? { decision: r.decision as MailInboxDecision } : {}),
    ...(r.decidedTime ? { decidedTime: moment(r.decidedTime) } : {}),
    ...(r.decision === MailInboxDecision.Approved && r.amended !== null
      ? { amended: r.amended }
      : {}),
    ...(r.payment ? { payment: toPaymentMatch(r.payment) } : {}),
  };
};

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

const requireGmailIds = (ids: unknown, name = "gmailIds"): string[] => {
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > MAX_INBOX_MESSAGES ||
    !ids.every((id) => typeof id === "string" && GMAIL_ID.test(id))
  ) {
    throw new BadRequestException(
      `${name} must be 1 to ${MAX_INBOX_MESSAGES} Gmail message IDs`,
    );
  }
  return [...new Set(ids as string[])];
};

const optionalFlag = (value: unknown, name: string): boolean => {
  if (value !== undefined && typeof value !== "boolean") {
    throw new BadRequestException(`${name} must be true or false`);
  }
  return value === true;
};

const labelNames = (value: unknown, where: string): string[] => {
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    !value.every(
      (n) => typeof n === "string" && n.length >= 1 && n.length <= 225,
    )
  ) {
    throw new BadRequestException(`${where} must be label names`);
  }
  return [...new Set(value as string[])];
};

/**
 * The inbox (docs/plans/email-management phase 5; ADR 0030): the messages
 * in it with what the classifier suggested as they arrived, and what is
 * decided about them. Approving writes the labels (and archives or marks
 * read) through a change batch, as applying a proposal does, and records
 * the decision, which undoing the batch takes back; skipping records it
 * and leaves Gmail alone. Metadata only; never message text.
 */
@Injectable()
export class MailInboxService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly changes: MailChangeService,
    private readonly agent: MinervaMailAgentClient,
  ) {}

  /**
   * A page of the user's inbox and the statistics strip's counts.
   *
   * @throws BadRequestException a filter is not what it should be
   */
  async list(
    userId: string,
    q: MailInboxQuery,
  ): Promise<ListMailInboxResponse> {
    if (q.pageSize < 1 || q.pageSize > MAIL_INBOX_MAX_PAGE_SIZE) {
      throw new BadRequestException(
        `pageSize must be from 1 to ${MAIL_INBOX_MAX_PAGE_SIZE}`,
      );
    }
    if (q.startPage < 0) {
      throw new BadRequestException("startPage must not be negative");
    }
    if (q.accountId !== undefined && !UUID.test(q.accountId)) {
      throw new BadRequestException("accountId must be a mail account ID");
    }
    if (
      q.minConfidence !== undefined &&
      !(q.minConfidence >= 0 && q.minConfidence <= 1)
    ) {
      throw new BadRequestException("minConfidence must be from 0 to 1");
    }
    for (const [name, value] of [
      ["search", q.search],
      ["from", q.from],
      ["subject", q.subject],
    ] as const) {
      if (value !== undefined && value.length > 200) {
        throw new BadRequestException(`${name} must be at most 200 characters`);
      }
    }
    let since: string;
    if (q.approvedSince !== undefined) {
      const parsed = moment(q.approvedSince, moment.ISO_8601, true);
      if (!parsed.isValid()) {
        throw new BadRequestException("approvedSince must be an ISO 8601 time");
      }
      since = parsed.toISOString();
    } else {
      since = moment().subtract(DEFAULT_APPROVED_HOURS, "hours").toISOString();
    }

    const scope: Record<string, unknown> = {
      account: { userId: { _eq: userId } },
      ...(q.accountId ? { accountId: { _eq: q.accountId } } : {}),
    };
    // To review: in the inbox, undecided, and not handled by a filter.
    const review = {
      inInbox: { _eq: true },
      decision: { _is_null: true },
      filtered: { _eq: false },
    };
    const approved = {
      decision: { _eq: MailInboxDecision.Approved },
      decidedTime: { _gte: since },
    };
    const byStatus: Record<MailInboxStatus, Record<string, unknown>> = {
      [MailInboxStatus.Review]: review,
      [MailInboxStatus.Unread]: {
        inInbox: { _eq: true },
        unread: { _eq: true },
      },
      [MailInboxStatus.Approved]: approved,
      [MailInboxStatus.All]: { inInbox: { _eq: true } },
    };
    const pattern = likePattern(q.search);
    const fromPattern = likePattern(q.from);
    const subjectPattern = likePattern(q.subject);
    const where = {
      _and: [
        scope,
        byStatus[q.status],
        ...(q.minConfidence !== undefined
          ? [{ topScore: { _gte: q.minConfidence } }]
          : []),
        ...(pattern
          ? [
              {
                message: {
                  _or: [
                    { subject: { _ilike: pattern } },
                    { fromAddress: { _ilike: pattern } },
                    { fromName: { _ilike: pattern } },
                  ],
                },
              },
            ]
          : []),
        ...(fromPattern
          ? [
              {
                message: {
                  _or: [
                    { fromAddress: { _ilike: fromPattern } },
                    { fromName: { _ilike: fromPattern } },
                  ],
                },
              },
            ]
          : []),
        ...(subjectPattern
          ? [{ message: { subject: { _ilike: subjectPattern } } }]
          : []),
      ],
    };
    const dir =
      q.sort === SortDirection.ASC ||
      q.sort === SortDirection.ASC_NULL_FIRST ||
      q.sort === SortDirection.ASC_NULL_LAST
        ? "asc"
        : "desc";
    const last = `${dir}_nulls_last`;
    const orderBy =
      q.status === MailInboxStatus.Approved &&
      q.sortBy === MailInboxSort.ReceivedTime &&
      !q.sort
        ? [{ decidedTime: "desc" }]
        : q.sortBy === MailInboxSort.Confidence
          ? [{ topScore: last }, { receivedTime: "desc" }]
          : q.sortBy === MailInboxSort.From
            ? [
                { message: { fromName: last } },
                { message: { fromAddress: last } },
                { receivedTime: "desc" },
              ]
            : q.sortBy === MailInboxSort.Subject
              ? [{ message: { subject: last } }, { receivedTime: "desc" }]
              : [{ receivedTime: dir }];

    const query = gql`
      query ListMailInbox(
        $where: minerva_mail_inbox_bool_exp!
        $orderBy: [minerva_mail_inbox_order_by!]!
        $limit: Int!
        $offset: Int!
        $inInbox: minerva_mail_inbox_bool_exp!
        $toReview: minerva_mail_inbox_bool_exp!
        $highConfidence: minerva_mail_inbox_bool_exp!
        $noSuggestion: minerva_mail_inbox_bool_exp!
        $unread: minerva_mail_inbox_bool_exp!
        $approved: minerva_mail_inbox_bool_exp!
      ) {
        page: minerva_mail_inbox(
          where: $where
          order_by: $orderBy
          limit: $limit
          offset: $offset
        ) {
          accountId
          gmailId
          threadId
          threadSize
          receivedTime
          inInbox
          unread
          scoredTime
          topScore
          decision
          decidedTime
          amended
          payment {
            ${PAYMENT_MATCH_FIELDS}
          }
          message {
            fromName
            fromAddress
            subject
            snippet
            starred
            starIcon
            messageLabels {
              label {
                name
                type
              }
            }
            score {
              suggestions {
                rank
                score
                ticked
                label {
                  name
                }
              }
            }
          }
        }
        count: minerva_mail_inbox_aggregate(where: $where) {
          aggregate {
            count
          }
        }
        inInbox: minerva_mail_inbox_aggregate(where: $inInbox) {
          aggregate {
            count
          }
        }
        toReview: minerva_mail_inbox_aggregate(where: $toReview) {
          aggregate {
            count
          }
        }
        highConfidence: minerva_mail_inbox_aggregate(where: $highConfidence) {
          aggregate {
            count
          }
        }
        noSuggestion: minerva_mail_inbox_aggregate(where: $noSuggestion) {
          aggregate {
            count
          }
        }
        unread: minerva_mail_inbox_aggregate(where: $unread) {
          aggregate {
            count
          }
        }
        approved: minerva_mail_inbox_aggregate(where: $approved) {
          aggregate {
            count
          }
        }
      }
    `;
    type Count = { aggregate: { count: number } };
    const response = await this.graphQLClient.request<{
      page: GraphQlInboxRow[];
      count: Count;
      inInbox: Count;
      toReview: Count;
      highConfidence: Count;
      noSuggestion: Count;
      unread: Count;
      approved: Count;
    }>(query, {
      where,
      orderBy,
      limit: q.pageSize,
      offset: q.pageSize * q.startPage,
      inInbox: { _and: [scope, { inInbox: { _eq: true } }] },
      toReview: { _and: [scope, review] },
      highConfidence: {
        _and: [scope, review, { topScore: { _gte: MAIL_INBOX_HIGH } }],
      },
      noSuggestion: { _and: [scope, review, { topScore: { _is_null: true } }] },
      unread: { _and: [scope, byStatus[MailInboxStatus.Unread]] },
      approved: { _and: [scope, approved] },
    });
    const summary: MailInboxSummary = {
      inInbox: response.inInbox.aggregate.count,
      toReview: response.toReview.aggregate.count,
      highConfidence: response.highConfidence.aggregate.count,
      noSuggestion: response.noSuggestion.aggregate.count,
      unread: response.unread.aggregate.count,
      approved: response.approved.aggregate.count,
    };
    return {
      count: response.count.aggregate.count,
      messages: response.page.map(toMessage),
      summary,
    };
  }

  /**
   * Approves messages' suggestions: each message's labels as the picker
   * left them, and, if asked, archived and marked read, the same for their
   * threads with wholeThread. What Gmail needs changing is written as one
   * batch; each message in the inbox among them is recorded as approved,
   * and as amended when its labels are not its ticked suggestion's.
   *
   * @throws BadRequestException a field is not what it should be, or a
   *   message is not in the account
   * @throws NotFoundException the account is not the user's
   * @throws ServiceUnavailableException writes are turned off
   * @throws ConflictException the mailbox is linked for reading only
   */
  async approve(
    userId: string,
    accountId: string,
    request: ApproveMailMessagesRequest,
  ): Promise<ApproveMailMessagesResponse> {
    this.requireAccountId(accountId);
    const approvals = request?.messages;
    if (
      !Array.isArray(approvals) ||
      approvals.length < 1 ||
      approvals.length > MAX_INBOX_MESSAGES
    ) {
      throw new BadRequestException(
        `messages must be 1 to ${MAX_INBOX_MESSAGES} messages`,
      );
    }
    const wanted = new Map<string, { add: string[]; remove: string[] }>();
    approvals.forEach((a, i) => {
      const where = `messages[${i}]`;
      if (!a || typeof a.gmailId !== "string" || !GMAIL_ID.test(a.gmailId)) {
        throw new BadRequestException(`${where}.gmailId must be a Gmail ID`);
      }
      if (wanted.has(a.gmailId)) {
        throw new BadRequestException(`${where} names its message again`);
      }
      const add = labelNames(a.add, `${where}.add`);
      const remove = labelNames(a.remove, `${where}.remove`);
      if (add.some((n) => remove.includes(n))) {
        throw new BadRequestException(
          `${where} adds and removes the same label`,
        );
      }
      if ([...add, ...remove].some((n) => MAIL_FLAG_LABELS.includes(n))) {
        throw new BadRequestException(
          `${where} names INBOX or UNREAD: use archive and markRead`,
        );
      }
      wanted.set(a.gmailId, { add, remove });
    });
    const archive = optionalFlag(request.archive, "archive");
    const markRead = optionalFlag(request.markRead, "markRead");
    const wholeThread = optionalFlag(request.wholeThread, "wholeThread");
    const newLabels =
      request.newLabels === undefined
        ? []
        : labelNames(request.newLabels, "newLabels");

    await this.requireOwned(userId, accountId);
    const selected = await this.targets(accountId, [...wanted.keys()]);
    // Thread-mates take the change of the selected message in their thread.
    type Want = { add: string[]; remove: string[] };
    const byThread = new Map<string, Want>();
    for (const m of selected) {
      const want = wanted.get(m.gmailId);
      if (want && !byThread.has(m.threadId)) byThread.set(m.threadId, want);
    }
    const all = wholeThread
      ? await this.threadMates(accountId, selected)
      : selected;

    const changes: MailLabelChange[] = [];
    for (const m of all) {
      const want = wanted.get(m.gmailId) ?? byThread.get(m.threadId);
      if (!want) continue;
      const has = userLabels(m);
      const add = want.add.filter((n) => !has.includes(n));
      const remove = want.remove.filter((n) => has.includes(n));
      if (archive && m.inInbox) remove.push("INBOX");
      if (markRead && m.unread) remove.push("UNREAD");
      if (add.length + remove.length) {
        changes.push({ gmailId: m.gmailId, add, remove });
      }
    }
    const batch = changes.length
      ? await this.changes.apply(userId, accountId, {
          changes,
          ...(newLabels.length ? { newLabels } : {}),
        })
      : undefined;

    // A decision for each message in the inbox: those selected, and their
    // thread-mates there too.
    const decided = all.filter((m) => wanted.has(m.gmailId) || m.inInbox);
    const now = new Date().toISOString();
    const rows = decided.map((m) => {
      const want = (wanted.get(m.gmailId) ?? byThread.get(m.threadId)) as Want;
      const has = userLabels(m);
      const suggested = (m.score?.suggestions ?? [])
        .filter((s) => s.ticked && !has.includes(s.label.name))
        .map((s) => s.label.name);
      const added = want.add.filter((n) => !has.includes(n));
      const removed = want.remove.filter((n) => has.includes(n));
      return {
        messageId: m.id,
        accountId,
        decision: MailInboxDecision.Approved,
        ...(m.score ? { modelRun: m.score.modelRun } : {}),
        amended: removed.length > 0 || !sameSet(added, suggested),
        batchId:
          batch && changes.some((c) => c.gmailId === m.gmailId)
            ? batch.id
            : null,
        userId,
        decidedTime: now,
      };
    });
    await this.recordDecisions(rows);
    return {
      approved: rows.length,
      changed: changes.length,
      ...(batch ? { batch } : {}),
    };
  }

  /**
   * Leaves messages for now: recorded as skipped, Gmail unchanged.
   *
   * @throws BadRequestException a message is not in the account
   * @throws NotFoundException the account is not the user's
   */
  async skip(
    userId: string,
    accountId: string,
    request: SkipMailMessagesRequest,
  ): Promise<SkipMailMessagesResponse> {
    this.requireAccountId(accountId);
    const gmailIds = requireGmailIds(request?.gmailIds);
    await this.requireOwned(userId, accountId);
    const found = await this.targets(accountId, gmailIds);
    const now = new Date().toISOString();
    await this.recordDecisions(
      found.map((m) => ({
        messageId: m.id,
        accountId,
        decision: MailInboxDecision.Skipped,
        ...(m.score ? { modelRun: m.score.modelRun } : {}),
        amended: false,
        batchId: null,
        userId,
        decidedTime: now,
      })),
    );
    return { skipped: found.length };
  }

  /**
   * Archives messages or marks them read (or both), deciding nothing about
   * their suggestions: a batch of the flags Minerva says need changing.
   *
   * @throws BadRequestException neither archive nor markRead, or a message
   *   is not in the account
   */
  async updateFlags(
    userId: string,
    accountId: string,
    request: UpdateMailMessageFlagsRequest,
  ): Promise<UpdateMailMessageFlagsResponse> {
    this.requireAccountId(accountId);
    const gmailIds = requireGmailIds(request?.gmailIds);
    const archive = optionalFlag(request.archive, "archive");
    const markRead = optionalFlag(request.markRead, "markRead");
    const wholeThread = optionalFlag(request.wholeThread, "wholeThread");
    if (!archive && !markRead) {
      throw new BadRequestException("Say archive, markRead or both");
    }
    await this.requireOwned(userId, accountId);
    const selected = await this.targets(accountId, gmailIds);
    const all = wholeThread
      ? await this.threadMates(accountId, selected)
      : selected;
    const changes: MailLabelChange[] = all.flatMap((m) => {
      const remove = [
        ...(archive && m.inInbox ? ["INBOX"] : []),
        ...(markRead && m.unread ? ["UNREAD"] : []),
      ];
      return remove.length ? [{ gmailId: m.gmailId, add: [], remove }] : [];
    });
    if (changes.length === 0) return { changed: 0 };
    const batch = await this.changes.apply(userId, accountId, { changes });
    return { changed: changes.length, batch };
  }

  /**
   * A message of the user's, read live from Gmail by the agent to be shown
   * once: never stored, logged or cached here.
   *
   * @throws NotFoundException the account is not the user's, or Gmail has
   *   no such message
   * @throws ConflictException the mailbox is not linked to Gmail
   */
  async content(
    userId: string,
    accountId: string,
    gmailId: string,
  ): Promise<MailMessageContent> {
    this.requireAccountId(accountId);
    if (typeof gmailId !== "string" || !GMAIL_ID.test(gmailId)) {
      throw new BadRequestException("gmailId must be a Gmail message ID");
    }
    const query = gql`
      query DescribeMailContentAccount($accountId: uuid!, $userId: uuid!) {
        minerva_mail_accounts(
          where: { id: { _eq: $accountId }, userId: { _eq: $userId } }
        ) {
          email
          linkedTime
        }
      }
    `;
    const account = (
      await this.graphQLClient.request<{
        minerva_mail_accounts: { email: string; linkedTime: string | null }[];
      }>(query, { accountId, userId })
    ).minerva_mail_accounts[0];
    if (!account) throw new NotFoundException(`No mail account ${accountId}`);
    if (!account.linkedTime) {
      throw new ConflictException(
        "The mailbox is not linked to Gmail: link it from the Inbox first",
      );
    }
    const m = await this.agent.readMessage(account.email, gmailId);
    return {
      gmailId: m.gmailId,
      threadId: m.threadId,
      ...(m.subject !== undefined ? { subject: m.subject } : {}),
      ...(m.from ? { from: m.from } : {}),
      replyTo: m.replyTo,
      to: m.to,
      cc: m.cc,
      ...(m.sentTime ? { sentTime: moment(m.sentTime) } : {}),
      receivedTime: moment(m.receivedTime),
      text: m.text,
      ...(m.html !== undefined ? { html: m.html } : {}),
      truncated: m.truncated,
      attachments: m.attachments,
    };
  }

  private requireAccountId(accountId: string): void {
    if (typeof accountId !== "string" || !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a mail account ID");
    }
  }

  /** @throws NotFoundException the account is not the user's */
  private async requireOwned(userId: string, accountId: string): Promise<void> {
    const query = gql`
      query DescribeMailInboxAccount($accountId: uuid!, $userId: uuid!) {
        minerva_mail_accounts(
          where: { id: { _eq: $accountId }, userId: { _eq: $userId } }
        ) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts: { id: string }[];
    }>(query, { accountId, userId });
    if (!response.minerva_mail_accounts.length) {
      throw new NotFoundException(`No mail account ${accountId}`);
    }
  }

  /**
   * The messages, as Minerva has them.
   *
   * @throws BadRequestException one is not in the account
   */
  private async targets(
    accountId: string,
    gmailIds: string[],
  ): Promise<GraphQlTarget[]> {
    const query = gql`
      query ListMailInboxTargets($accountId: uuid!, $gmailIds: [String!]!) {
        minerva_mail_messages(
          where: { accountId: { _eq: $accountId }, gmailId: { _in: $gmailIds } }
        ) {
          ${TARGET_FIELDS}
        }
      }
    `;
    const found = (
      await this.graphQLClient.request<{
        minerva_mail_messages: GraphQlTarget[];
      }>(query, { accountId, gmailIds })
    ).minerva_mail_messages;
    const missing = gmailIds.filter(
      (id) => !found.some((m) => m.gmailId === id),
    );
    if (missing.length) {
      throw new BadRequestException(
        `No such messages in the account: ${missing.slice(0, 5).join(", ")}${
          missing.length > 5 ? ", ..." : ""
        }`,
      );
    }
    return found;
  }

  /** The messages and every other message Minerva keeps in their threads. */
  private async threadMates(
    accountId: string,
    selected: GraphQlTarget[],
  ): Promise<GraphQlTarget[]> {
    const query = gql`
      query ListMailInboxThreads($accountId: uuid!, $threadIds: [String!]!) {
        minerva_mail_messages(
          where: { accountId: { _eq: $accountId }, threadId: { _in: $threadIds } }
        ) {
          ${TARGET_FIELDS}
        }
      }
    `;
    const mates = (
      await this.graphQLClient.request<{
        minerva_mail_messages: GraphQlTarget[];
      }>(query, {
        accountId,
        threadIds: [...new Set(selected.map((m) => m.threadId))],
      })
    ).minerva_mail_messages;
    const all = new Map(selected.map((m) => [m.gmailId, m]));
    for (const m of mates) if (!all.has(m.gmailId)) all.set(m.gmailId, m);
    return [...all.values()];
  }

  private async recordDecisions(
    rows: Record<string, unknown>[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const mutation = gql`
      mutation RecordMailInboxDecisions(
        $decisions: [minerva_mail_inbox_decisions_insert_input!]!
      ) {
        insert_minerva_mail_inbox_decisions(
          objects: $decisions
          on_conflict: {
            constraint: mail_inbox_decisions_pkey
            update_columns: [
              decision
              modelRun
              amended
              batchId
              userId
              decidedTime
            ]
          }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, { decisions: rows });
  }
}
