import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ApplyMailChangesRequest,
  DismissMailProposalsRequest,
  MailAuditAction,
  MailChange,
  MailChangeBatch,
  MailChangeBatchKind,
  MailChangeBatchReport,
  MailChangeBatchStatus,
  MailChangeStatus,
  UpdateMailChangeBatchRequest,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  minervaConfig,
  type MinervaConfigType,
} from "../../../config/configuration";
import {
  type AgentGmailChange,
  MinervaMailAgentClient,
} from "./MinervaMailAgentClient";

export const MAX_CHANGES = 10_000;
/** Rows a single insert carries. */
const CHUNK = 1000;
/** Changes a page of DescribeMailChangeBatch holds at most. */
export const MAX_CHANGE_PAGE = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;
const WRITE_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const OUTCOMES: string[] = [
  MailChangeStatus.Written,
  MailChangeStatus.Unchanged,
  MailChangeStatus.Changed,
  MailChangeStatus.Gone,
  MailChangeStatus.Failed,
];

const COUNT_FIELDS = Object.values(MailChangeStatus)
  .map(
    (status) =>
      `${status}: changes_aggregate(where: { status: { _eq: "${status}" } }) { aggregate { count } }`,
  )
  .join("\n");

const BATCH_FIELDS = `
  id
  accountId
  kind
  undoesBatchId
  status
  requestedTime
  finishedTime
  error
  undoneBy { id }
  total: changes_aggregate { aggregate { count } }
  ${COUNT_FIELDS}
`;

type Count = { aggregate: { count: number } };

type GraphQlBatch = {
  id: string;
  accountId: string;
  kind: string;
  undoesBatchId: string | null;
  status: string;
  requestedTime: string;
  finishedTime: string | null;
  error: string | null;
  undoneBy: { id: string }[];
  total: Count;
} & Record<MailChangeStatus, Count>;

type GraphQlChangeLabel = { role: string; name: string };

type GraphQlChange = {
  gmailId: string;
  messageId: string | null;
  status: string;
  message: { subject: string | null; fromAddress: string | null } | null;
  labels: GraphQlChangeLabel[];
};

type GraphQlAccount = {
  id: string;
  userId: string;
  email: string;
  linkScope: string | null;
};

type GraphQlLabel = {
  id: string;
  name: string;
  type: string;
  gmailLabelId: string | null;
};

type GraphQlMessage = {
  id: string;
  gmailId: string;
  messageLabels: { label: { name: string; type: string } }[];
};

const toBatch = (b: GraphQlBatch): MailChangeBatch => ({
  id: b.id,
  accountId: b.accountId,
  kind: b.kind as MailChangeBatchKind,
  ...(b.undoesBatchId ? { undoesBatchId: b.undoesBatchId } : {}),
  ...(b.undoneBy[0] ? { undoneByBatchId: b.undoneBy[0].id } : {}),
  status: b.status as MailChangeBatchStatus,
  requestedTime: moment(b.requestedTime),
  ...(b.finishedTime ? { finishedTime: moment(b.finishedTime) } : {}),
  ...(b.error ? { error: b.error } : {}),
  messages: b.total.aggregate.count,
  counts: {
    pending: b.pending.aggregate.count,
    written: b.written.aggregate.count,
    unchanged: b.unchanged.aggregate.count,
    changed: b.changed.aggregate.count,
    gone: b.gone.aggregate.count,
    failed: b.failed.aggregate.count,
  },
});

const labelsOf = (c: GraphQlChange, role: string): string[] =>
  c.labels
    .filter((l) => l.role === role)
    .map((l) => l.name)
    .sort();

const toChange = (c: GraphQlChange): MailChange => ({
  gmailId: c.gmailId,
  ...(c.message?.subject ? { subject: c.message.subject } : {}),
  ...(c.message?.fromAddress ? { fromAddress: c.message.fromAddress } : {}),
  status: c.status as MailChangeStatus,
  had: labelsOf(c, "had"),
  add: labelsOf(c, "add"),
  remove: labelsOf(c, "remove"),
});

const chunks = <T>(items: T[], size = CHUNK): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

const requireId = (id: string, name: string): string => {
  if (!UUID.test(id)) throw new BadRequestException(`${name} must be an ID`);
  return id;
};

const userLabelsOf = (m: GraphQlMessage): string[] =>
  m.messageLabels
    .filter((ml) => ml.label.type === "user")
    .map((ml) => ml.label.name)
    .sort();

/** A change as asked for, its labels checked and the message found. */
type PlannedChange = {
  gmailId: string;
  messageId: string;
  had: string[];
  add: string[];
  remove: string[];
};

/**
 * Writes to Gmail (docs/plans/email-management phase 4; ADR 0030,
 * "Changes are reviewed, logged and undoable"). A batch is recorded with
 * each message's user labels as Minerva has them, then handed to the mail
 * agent, which writes it in the background: a message whose labels in
 * Gmail are no longer those recorded was changed there, and is synced
 * again instead of written. The agent reports each change's outcome; once
 * done, what was written is recorded as decided, so the proposals behind
 * it show as applied. An undo is a batch of the reverses of what was
 * written, recorded against the labels the batch left.
 */
@Injectable()
export class MailChangeService {
  private readonly logger = new Logger(MailChangeService.name);

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly agent: MinervaMailAgentClient,
    @Inject(minervaConfig.KEY) private readonly minerva: MinervaConfigType,
  ) {}

  /**
   * Records and starts a batch of label changes.
   *
   * @throws ServiceUnavailableException writes are turned off
   * @throws BadRequestException a change is not what it should be, or names
   *   a label Gmail does not have or a message the account does not
   * @throws NotFoundException the account is not the user's
   * @throws ConflictException the mailbox is linked for reading only
   */
  async apply(
    userId: string,
    accountId: string,
    request: ApplyMailChangesRequest,
  ): Promise<MailChangeBatch> {
    this.requireWrites();
    requireId(accountId, "accountId");
    const changes = request?.changes;
    if (
      !Array.isArray(changes) ||
      changes.length < 1 ||
      changes.length > MAX_CHANGES
    ) {
      throw new BadRequestException(
        `changes must be 1 to ${MAX_CHANGES} changes`,
      );
    }
    const seen = new Set<string>();
    changes.forEach((c, i) => {
      const where = `changes[${i}]`;
      if (!c || typeof c.gmailId !== "string" || !GMAIL_ID.test(c.gmailId)) {
        throw new BadRequestException(`${where}.gmailId must be a Gmail ID`);
      }
      if (seen.has(c.gmailId)) {
        throw new BadRequestException(`${where} names its message again`);
      }
      seen.add(c.gmailId);
      for (const key of ["add", "remove"] as const) {
        const names = c[key];
        if (
          !Array.isArray(names) ||
          names.some(
            (n) => typeof n !== "string" || n.length < 1 || n.length > 225,
          )
        ) {
          throw new BadRequestException(`${where}.${key} must be label names`);
        }
      }
      if (c.add.length + c.remove.length === 0) {
        throw new BadRequestException(`${where} changes nothing`);
      }
      if (c.add.some((n) => c.remove.includes(n))) {
        throw new BadRequestException(
          `${where} adds and removes the same label`,
        );
      }
    });
    const account = await this.writableAccount(userId, accountId);
    const labels = await this.writableLabels(
      accountId,
      changes.flatMap((c) => [...c.add, ...c.remove]),
    );
    const messages = await this.messagesOf(
      accountId,
      changes.map((c) => c.gmailId),
    );
    const unknown = changes.filter((c) => !messages.has(c.gmailId));
    if (unknown.length) {
      throw new BadRequestException(
        `No such messages in the account: ${unknown
          .slice(0, 5)
          .map((c) => c.gmailId)
          .join(", ")}${unknown.length > 5 ? ", ..." : ""}`,
      );
    }
    const planned: PlannedChange[] = changes.map((c) => {
      const message = messages.get(c.gmailId) as GraphQlMessage;
      return {
        gmailId: c.gmailId,
        messageId: message.id,
        had: userLabelsOf(message),
        add: [...new Set(c.add)].sort(),
        remove: [...new Set(c.remove)].sort(),
      };
    });
    return this.start(
      userId,
      account,
      MailChangeBatchKind.Apply,
      planned,
      labels,
    );
  }

  /**
   * Undoes a finished apply: the reverse of each change it wrote, on
   * messages still as it left them. The undo is a batch of its own.
   *
   * @throws ServiceUnavailableException writes are turned off
   * @throws NotFoundException no such batch of the user's
   * @throws ConflictException it is not a finished apply, it was undone
   *   already, or a label it wrote is gone from Gmail
   */
  async undo(userId: string, batchId: string): Promise<MailChangeBatch> {
    this.requireWrites();
    requireId(batchId, "batchId");
    const query = gql`
      query DescribeMailChangeBatchToUndo($id: uuid!, $userId: uuid!) {
        minerva_mail_change_batches(
          where: { id: { _eq: $id }, account: { userId: { _eq: $userId } } }
        ) {
          id
          accountId
          kind
          status
          undoneBy {
            id
          }
          changes(where: { status: { _eq: "written" } }) {
            gmailId
            messageId
            status
            message {
              subject
              fromAddress
            }
            labels {
              role
              name
            }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_change_batches: {
        id: string;
        accountId: string;
        kind: string;
        status: string;
        undoneBy: { id: string }[];
        changes: GraphQlChange[];
      }[];
    }>(query, { id: batchId, userId });
    const batch = response.minerva_mail_change_batches[0];
    if (!batch) throw new NotFoundException(`No change batch ${batchId}`);
    if (batch.kind !== MailChangeBatchKind.Apply) {
      throw new ConflictException("Only an apply can be undone");
    }
    if (batch.status !== MailChangeBatchStatus.Done) {
      throw new ConflictException("The batch has not finished");
    }
    if (batch.undoneBy.length) {
      throw new ConflictException("The batch has been undone already");
    }
    if (batch.changes.length === 0) {
      throw new ConflictException("The batch wrote nothing to undo");
    }
    const account = await this.writableAccount(userId, batch.accountId);
    const planned: PlannedChange[] = batch.changes.map((c) => {
      const had = labelsOf(c, "had");
      const add = labelsOf(c, "add");
      const remove = labelsOf(c, "remove");
      // What the apply left is what Gmail must still have.
      const after = [
        ...new Set([...had.filter((l) => !remove.includes(l)), ...add]),
      ].sort();
      return {
        gmailId: c.gmailId,
        messageId: c.messageId ?? "",
        had: after,
        add: remove,
        remove: add,
      };
    });
    let labels: Map<string, GraphQlLabel>;
    try {
      labels = await this.writableLabels(
        batch.accountId,
        planned.flatMap((c) => [...c.add, ...c.remove]),
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
    return this.start(
      userId,
      account,
      MailChangeBatchKind.Undo,
      planned,
      labels,
      batchId,
    );
  }

  /** The account's batches, newest first. */
  async list(
    userId: string,
    accountId: string,
    limit: number,
  ): Promise<MailChangeBatch[]> {
    requireId(accountId, "accountId");
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new BadRequestException("limit must be between 1 and 200");
    }
    const query = gql`
      query ListMailChangeBatches($accountId: uuid!, $userId: uuid!, $limit: Int!) {
        minerva_mail_change_batches(
          where: {
            accountId: { _eq: $accountId }
            account: { userId: { _eq: $userId } }
          }
          order_by: { requestedTime: desc }
          limit: $limit
        ) {
          ${BATCH_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_change_batches: GraphQlBatch[];
    }>(query, { accountId, userId, limit });
    return response.minerva_mail_change_batches.map(toBatch);
  }

  /**
   * A batch and a page of its changes.
   *
   * @throws NotFoundException no such batch of the user's
   */
  async describe(
    userId: string,
    batchId: string,
    offset: number,
    limit: number,
  ): Promise<{ batch: MailChangeBatch; changes: MailChange[] }> {
    requireId(batchId, "batchId");
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException("offset must be 0 or more");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CHANGE_PAGE) {
      throw new BadRequestException(
        `limit must be between 1 and ${MAX_CHANGE_PAGE}`,
      );
    }
    const query = gql`
      query DescribeMailChangeBatch($id: uuid!, $userId: uuid!, $offset: Int!, $limit: Int!) {
        minerva_mail_change_batches(
          where: { id: { _eq: $id }, account: { userId: { _eq: $userId } } }
        ) {
          ${BATCH_FIELDS}
          changes(order_by: { gmailId: asc }, offset: $offset, limit: $limit) {
            gmailId
            messageId
            status
            message { subject fromAddress }
            labels { role name }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_change_batches: (GraphQlBatch & {
        changes: GraphQlChange[];
      })[];
    }>(query, { id: batchId, userId, offset, limit });
    const batch = response.minerva_mail_change_batches[0];
    if (!batch) throw new NotFoundException(`No change batch ${batchId}`);
    return { batch: toBatch(batch), changes: batch.changes.map(toChange) };
  }

  /**
   * Marks proposals processed without change: decided, so they no longer
   * wait for review, whichever run proposes them again. A proposal decided
   * already keeps its decision.
   *
   * @throws BadRequestException a proposal is not what it should be
   * @throws NotFoundException the account is not the user's
   */
  async dismiss(
    userId: string,
    accountId: string,
    request: DismissMailProposalsRequest,
  ): Promise<number> {
    requireId(accountId, "accountId");
    const proposals = request?.proposals;
    if (
      !Array.isArray(proposals) ||
      proposals.length < 1 ||
      proposals.length > MAX_CHANGES
    ) {
      throw new BadRequestException(
        `proposals must be 1 to ${MAX_CHANGES} proposals`,
      );
    }
    proposals.forEach((p, i) => {
      if (
        !p ||
        typeof p.gmailId !== "string" ||
        !GMAIL_ID.test(p.gmailId) ||
        typeof p.label !== "string" ||
        !p.label ||
        (p.action !== MailAuditAction.Add &&
          p.action !== MailAuditAction.Remove)
      ) {
        throw new BadRequestException(
          `proposals[${i}] must have a Gmail ID, a label and an action of add or remove`,
        );
      }
    });
    await this.ownedAccount(userId, accountId);
    const labels = await this.labelsByName(
      accountId,
      proposals.map((p) => p.label),
    );
    const messages = await this.messagesOf(
      accountId,
      proposals.map((p) => p.gmailId),
    );
    const rows = proposals.flatMap((p) => {
      const message = messages.get(p.gmailId);
      const label = labels.get(p.label);
      return message && label
        ? [
            {
              accountId,
              messageId: message.id,
              labelId: label.id,
              action: p.action,
              decision: "dismissed",
              userId,
            },
          ]
        : [];
    });
    const mutation = gql`
      mutation DismissMailProposals(
        $decisions: [minerva_mail_decisions_insert_input!]!
      ) {
        insert_minerva_mail_decisions(
          objects: $decisions
          on_conflict: { constraint: mail_decisions_pkey, update_columns: [] }
        ) {
          affected_rows
        }
      }
    `;
    let dismissed = 0;
    for (const chunk of chunks(rows)) {
      const response = await this.graphQLClient.request<{
        insert_minerva_mail_decisions: { affected_rows: number };
      }>(mutation, { decisions: chunk });
      dismissed += response.insert_minerva_mail_decisions.affected_rows;
    }
    return dismissed;
  }

  /**
   * The agent's report on a batch: where it is, and outcomes since its last
   * report. Done, what it wrote (or found already so) is recorded as
   * decided; for an undo, the decisions of the batch it reversed are taken
   * back for the messages it reversed.
   *
   * @throws NotFoundException no such batch
   * @throws ConflictException the batch has finished
   */
  async report(
    batchId: string,
    request: UpdateMailChangeBatchRequest,
  ): Promise<MailChangeBatch> {
    requireId(batchId, "batchId");
    const status = request?.status;
    if (!Object.values(MailChangeBatchReport).includes(status)) {
      throw new BadRequestException("status must be running, done or failed");
    }
    const error = request.error;
    if (status === MailChangeBatchReport.Failed) {
      if (typeof error !== "string" || !error || error.length > 500) {
        throw new BadRequestException(
          "a failed batch needs an error of at most 500 characters",
        );
      }
    } else if (error !== undefined) {
      throw new BadRequestException("only a failed batch has an error");
    }
    const outcomes = request.changes ?? [];
    if (!Array.isArray(outcomes) || outcomes.length > MAX_CHANGES) {
      throw new BadRequestException(
        `changes must be at most ${MAX_CHANGES} outcomes`,
      );
    }
    outcomes.forEach((o, i) => {
      if (
        !o ||
        typeof o.gmailId !== "string" ||
        !GMAIL_ID.test(o.gmailId) ||
        !OUTCOMES.includes(o.status)
      ) {
        throw new BadRequestException(
          `changes[${i}] must have a Gmail ID and an outcome other than pending`,
        );
      }
    });

    const query = gql`
      query DescribeMailChangeBatchForReport($id: uuid!) {
        minerva_mail_change_batches_by_pk(id: $id) {
          id
          accountId
          userId
          kind
          status
          undoesBatchId
        }
      }
    `;
    const current = (
      await this.graphQLClient.request<{
        minerva_mail_change_batches_by_pk: {
          id: string;
          accountId: string;
          userId: string;
          kind: string;
          status: string;
          undoesBatchId: string | null;
        } | null;
      }>(query, { id: batchId })
    ).minerva_mail_change_batches_by_pk;
    if (!current) throw new NotFoundException(`No change batch ${batchId}`);
    if (
      current.status === MailChangeBatchStatus.Done ||
      current.status === MailChangeBatchStatus.Failed
    ) {
      throw new ConflictException("The batch has finished");
    }

    const byStatus = new Map<string, string[]>();
    for (const o of outcomes) {
      byStatus.set(o.status, [...(byStatus.get(o.status) ?? []), o.gmailId]);
    }
    const outcome = gql`
      mutation UpdateMailChanges(
        $batchId: uuid!
        $gmailIds: [String!]!
        $status: String!
      ) {
        update_minerva_mail_changes(
          where: { batchId: { _eq: $batchId }, gmailId: { _in: $gmailIds } }
          _set: { status: $status }
        ) {
          affected_rows
        }
      }
    `;
    for (const [s, gmailIds] of byStatus) {
      for (const chunk of chunks(gmailIds)) {
        await this.graphQLClient.request(outcome, {
          batchId,
          gmailIds: chunk,
          status: s,
        });
      }
    }

    if (status === MailChangeBatchReport.Done) {
      await this.recordDecisions(current);
    }
    const update = gql`
      mutation UpdateMailChangeBatch($id: uuid!, $set: minerva_mail_change_batches_set_input!) {
        update_minerva_mail_change_batches_by_pk(pk_columns: { id: $id }, _set: $set) {
          ${BATCH_FIELDS}
        }
      }
    `;
    const finished =
      status === MailChangeBatchReport.Running
        ? {}
        : { finishedTime: new Date().toISOString() };
    const response = await this.graphQLClient.request<{
      update_minerva_mail_change_batches_by_pk: GraphQlBatch;
    }>(update, {
      id: batchId,
      set: { status, ...finished, ...(error ? { error } : {}) },
    });
    return toBatch(response.update_minerva_mail_change_batches_by_pk);
  }

  private requireWrites(): void {
    if (!this.minerva.mailWritesEnabled) {
      throw new ServiceUnavailableException(
        "Writes to Gmail are turned off (MINERVA_MAIL_WRITES_ENABLED)",
      );
    }
  }

  private async ownedAccount(
    userId: string,
    accountId: string,
  ): Promise<GraphQlAccount> {
    const query = gql`
      query DescribeMailAccountForChanges($id: uuid!, $userId: uuid!) {
        minerva_mail_accounts(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
        ) {
          id
          userId
          email
          linkScope
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts: GraphQlAccount[];
    }>(query, { id: accountId, userId });
    const account = response.minerva_mail_accounts[0];
    if (!account) throw new NotFoundException(`No mail account ${accountId}`);
    return account;
  }

  private async writableAccount(
    userId: string,
    accountId: string,
  ): Promise<GraphQlAccount> {
    const account = await this.ownedAccount(userId, accountId);
    if (!account.linkScope?.split(" ").includes(WRITE_SCOPE)) {
      throw new ConflictException(
        "The mailbox is linked for reading only: allow changes from the Inbox first",
      );
    }
    return account;
  }

  private async labelsByName(
    accountId: string,
    names: string[],
  ): Promise<Map<string, GraphQlLabel>> {
    const query = gql`
      query ListMailLabelsForChanges($accountId: uuid!, $names: [String!]!) {
        minerva_mail_labels(
          where: { accountId: { _eq: $accountId }, name: { _in: $names } }
        ) {
          id
          name
          type
          gmailLabelId
        }
      }
    `;
    const found = new Map<string, GraphQlLabel>();
    for (const chunk of chunks([...new Set(names)])) {
      const response = await this.graphQLClient.request<{
        minerva_mail_labels: GraphQlLabel[];
      }>(query, { accountId, names: chunk });
      for (const l of response.minerva_mail_labels) found.set(l.name, l);
    }
    return found;
  }

  /** The labels by name, every one a user label Gmail has. */
  private async writableLabels(
    accountId: string,
    names: string[],
  ): Promise<Map<string, GraphQlLabel>> {
    const labels = await this.labelsByName(accountId, names);
    const missing = [...new Set(names)].filter((n) => {
      const l = labels.get(n);
      return !l || l.type !== "user" || !l.gmailLabelId;
    });
    if (missing.length) {
      throw new BadRequestException(
        `Not user labels Gmail has: ${missing.slice(0, 5).join(", ")}${
          missing.length > 5 ? ", ..." : ""
        }`,
      );
    }
    return labels;
  }

  private async messagesOf(
    accountId: string,
    gmailIds: string[],
  ): Promise<Map<string, GraphQlMessage>> {
    const query = gql`
      query ListMailMessagesForChanges(
        $accountId: uuid!
        $gmailIds: [String!]!
      ) {
        minerva_mail_messages(
          where: { accountId: { _eq: $accountId }, gmailId: { _in: $gmailIds } }
        ) {
          id
          gmailId
          messageLabels {
            label {
              name
              type
            }
          }
        }
      }
    `;
    const found = new Map<string, GraphQlMessage>();
    for (const chunk of chunks([...new Set(gmailIds)])) {
      const response = await this.graphQLClient.request<{
        minerva_mail_messages: GraphQlMessage[];
      }>(query, { accountId, gmailIds: chunk });
      for (const m of response.minerva_mail_messages) found.set(m.gmailId, m);
    }
    return found;
  }

  /** Records a batch, then hands it to the agent. */
  private async start(
    userId: string,
    account: GraphQlAccount,
    kind: MailChangeBatchKind,
    planned: PlannedChange[],
    labels: Map<string, GraphQlLabel>,
    undoesBatchId?: string,
  ): Promise<MailChangeBatch> {
    const create = gql`
      mutation CreateMailChangeBatch(
        $batch: minerva_mail_change_batches_insert_input!
      ) {
        insert_minerva_mail_change_batches_one(object: $batch) {
          id
        }
      }
    `;
    let batchId: string;
    try {
      batchId = (
        await this.graphQLClient.request<{
          insert_minerva_mail_change_batches_one: { id: string };
        }>(create, {
          batch: {
            accountId: account.id,
            userId,
            kind,
            ...(undoesBatchId ? { undoesBatchId } : {}),
          },
        })
      ).insert_minerva_mail_change_batches_one.id;
    } catch (error) {
      // Two undos at once: the second meets the first's unique key.
      if (
        undoesBatchId &&
        /mail_change_batches_undoes_batch_id_key/.test(String(error))
      ) {
        throw new ConflictException("The batch has been undone already");
      }
      throw error;
    }
    const addChanges = gql`
      mutation CreateMailChanges(
        $changes: [minerva_mail_changes_insert_input!]!
      ) {
        insert_minerva_mail_changes(objects: $changes) {
          affected_rows
        }
      }
    `;
    for (const chunk of chunks(planned)) {
      await this.graphQLClient.request(addChanges, {
        changes: chunk.map((c) => ({
          batchId,
          gmailId: c.gmailId,
          ...(c.messageId ? { messageId: c.messageId } : {}),
          labels: {
            data: [
              ...c.had.map((name) => ({ role: "had", name })),
              ...c.add.map((name) => ({ role: "add", name })),
              ...c.remove.map((name) => ({ role: "remove", name })),
            ],
          },
        })),
      });
    }

    const label = (name: string) => ({
      name,
      gmailLabelId: labels.get(name)?.gmailLabelId as string,
    });
    const writes: AgentGmailChange[] = planned.map((c) => ({
      gmailId: c.gmailId,
      expected: c.had,
      add: c.add.map(label),
      remove: c.remove.map(label),
    }));
    try {
      await this.agent.startWrites({
        batchId,
        accountId: account.id,
        email: account.email,
        changes: writes,
      });
    } catch (error) {
      this.logger.warn(
        `Change batch ${batchId} could not start: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.fail(batchId, "The mail agent did not take the batch");
      throw error;
    }
    return (await this.describe(userId, batchId, 0, 1)).batch;
  }

  private async fail(batchId: string, error: string): Promise<void> {
    const mutation = gql`
      mutation FailMailChangeBatch(
        $id: uuid!
        $set: minerva_mail_change_batches_set_input!
      ) {
        update_minerva_mail_change_batches_by_pk(
          pk_columns: { id: $id }
          _set: $set
        ) {
          id
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      id: batchId,
      set: { status: "failed", error, finishedTime: new Date().toISOString() },
    });
  }

  /**
   * A finished apply's changes as decisions; a finished undo's as the
   * decisions it takes back.
   */
  private async recordDecisions(batch: {
    id: string;
    accountId: string;
    userId: string;
    kind: string;
    undoesBatchId: string | null;
  }): Promise<void> {
    const query = gql`
      query ListMailChangesDone($batchId: uuid!) {
        minerva_mail_changes(
          where: {
            batchId: { _eq: $batchId }
            status: { _in: ["written", "unchanged"] }
            messageId: { _is_null: false }
          }
        ) {
          messageId
          labels(where: { role: { _in: ["add", "remove"] } }) {
            role
            name
          }
        }
      }
    `;
    const done = (
      await this.graphQLClient.request<{
        minerva_mail_changes: {
          messageId: string;
          labels: GraphQlChangeLabel[];
        }[];
      }>(query, { batchId: batch.id })
    ).minerva_mail_changes;
    if (done.length === 0) return;

    if (batch.kind === MailChangeBatchKind.Undo && batch.undoesBatchId) {
      const takeBack = gql`
        mutation TakeBackMailDecisions($batchId: uuid!, $messageIds: [uuid!]!) {
          delete_minerva_mail_decisions(
            where: {
              batchId: { _eq: $batchId }
              messageId: { _in: $messageIds }
            }
          ) {
            affected_rows
          }
        }
      `;
      for (const chunk of chunks(done.map((c) => c.messageId))) {
        await this.graphQLClient.request(takeBack, {
          batchId: batch.undoesBatchId,
          messageIds: chunk,
        });
      }
      return;
    }

    const labels = await this.labelsByName(
      batch.accountId,
      done.flatMap((c) => c.labels.map((l) => l.name)),
    );
    const rows = done.flatMap((c) =>
      c.labels.flatMap((l) => {
        const label = labels.get(l.name);
        return label
          ? [
              {
                accountId: batch.accountId,
                messageId: c.messageId,
                labelId: label.id,
                action: l.role,
                decision: "applied",
                batchId: batch.id,
                userId: batch.userId,
                decidedTime: new Date().toISOString(),
              },
            ]
          : [];
      }),
    );
    const record = gql`
      mutation RecordMailDecisions(
        $decisions: [minerva_mail_decisions_insert_input!]!
      ) {
        insert_minerva_mail_decisions(
          objects: $decisions
          on_conflict: {
            constraint: mail_decisions_pkey
            update_columns: [decision, batchId, userId, decidedTime]
          }
        ) {
          affected_rows
        }
      }
    `;
    for (const chunk of chunks(rows)) {
      await this.graphQLClient.request(record, { decisions: chunk });
    }
  }
}
