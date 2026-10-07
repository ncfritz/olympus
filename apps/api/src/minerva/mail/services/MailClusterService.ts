import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateMailClusterItemsResponse,
  CreateMailClusterMembersRequest,
  CreateMailClusterPointsRequest,
  CreateMailClusterRunRequest,
  CreateMailClustersRequest,
  DescribeMailClusterResponse,
  GetMailClusterMapResponse,
  ListMailClusterMembersResponse,
  MailCluster,
  MailClusterRun,
  MailClusterRunStatus,
  MailClusterScope,
  MailClusterSuggestion,
  NewMailCluster,
  PublishMailClusterRunRequest,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";

export const MAX_CLUSTERS = 500;
export const MAX_CLUSTER_ITEMS = 5000;
export const MAX_MEMBER_PAGE = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;

const RUN_FIELDS = `
  id
  accountId
  embeddingVersion
  status
  startedTime
  finishedTime
  messages
`;

const CLUSTER_FIELDS = `
  id
  number
  scope
  scopeLabel {
    name
  }
  name
  size
  purity
  x
  y
  suggestion
  proposedName
  run {
    accountId
  }
  labels(order_by: { messages: desc }) {
    messages
    label {
      name
    }
  }
  senders(order_by: { messages: desc }) {
    sender
    messages
  }
`;

type GraphQlRun = {
  id: string;
  accountId: string;
  embeddingVersion: string;
  status: string;
  startedTime: string;
  finishedTime: string | null;
  messages: number | null;
};

type GraphQlCluster = {
  id: string;
  number: number;
  scope: string;
  scopeLabel: { name: string } | null;
  name: string;
  size: number;
  purity: number | string;
  x: number;
  y: number;
  suggestion: string | null;
  proposedName: string | null;
  run: { accountId: string };
  labels: { messages: number; label: { name: string } }[];
  senders: { sender: string; messages: number }[];
};

const toRun = (r: GraphQlRun): MailClusterRun => ({
  id: r.id,
  accountId: r.accountId,
  embeddingVersion: r.embeddingVersion,
  status: r.status as MailClusterRunStatus,
  startedTime: moment(r.startedTime),
  ...(r.finishedTime ? { finishedTime: moment(r.finishedTime) } : {}),
  ...(r.messages !== null ? { messages: r.messages } : {}),
});

const toCluster = (c: GraphQlCluster): MailCluster => ({
  id: c.id,
  accountId: c.run.accountId,
  number: c.number,
  scope: c.scope as MailClusterScope,
  ...(c.scopeLabel ? { scopeLabel: c.scopeLabel.name } : {}),
  name: c.name,
  size: c.size,
  purity: Number(c.purity),
  x: c.x,
  y: c.y,
  ...(c.suggestion
    ? { suggestion: c.suggestion as MailClusterSuggestion }
    : {}),
  ...(c.proposedName ? { proposedName: c.proposedName } : {}),
  labels: c.labels.map((l) => ({ label: l.label.name, messages: l.messages })),
  senders: c.senders.map((s) => ({ sender: s.sender, messages: s.messages })),
});

const requireId = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new BadRequestException(`${name} must be an ID`);
  }
  return value;
};

const unit = (value: unknown): boolean =>
  typeof value === "number" && value >= 0 && value <= 1;

const chunks = <T>(items: T[], size = 1000): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
};

/**
 * Clusters of mail (docs/plans/email-management phase 6): the classifier
 * posts a run per mailbox (agents only) — its clusters, their messages and
 * the map — and publishing it makes it the account's, dropping the runs
 * before it. The site reads the newest run: the map, a cluster with its
 * newest messages, its members to apply a suggestion to, and the clusters
 * that suggest something. Metadata only; never message text.
 */
@Injectable()
export class MailClusterService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * @throws BadRequestException a field is not what it should be
   * @throws NotFoundException no such account
   */
  async createRun(
    request: CreateMailClusterRunRequest,
  ): Promise<MailClusterRun> {
    const accountId = requireId(request?.accountId, "accountId");
    const version = request.embeddingVersion;
    if (
      typeof version !== "string" ||
      version.length < 1 ||
      version.length > 100
    ) {
      throw new BadRequestException(
        "embeddingVersion must be 1 to 100 characters",
      );
    }
    const query = gql`
      query DescribeMailClusterAccount($accountId: uuid!) {
        minerva_mail_accounts_by_pk(id: $accountId) {
          id
        }
      }
    `;
    const found = await this.graphQLClient.request<{
      minerva_mail_accounts_by_pk: { id: string } | null;
    }>(query, { accountId });
    if (!found.minerva_mail_accounts_by_pk) {
      throw new NotFoundException(`No mail account ${accountId}`);
    }
    const mutation = gql`
      mutation CreateMailClusterRun($run: minerva_mail_cluster_runs_insert_input!) {
        insert_minerva_mail_cluster_runs_one(object: $run) {
          ${RUN_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      insert_minerva_mail_cluster_runs_one: GraphQlRun;
    }>(mutation, { run: { accountId, embeddingVersion: version } });
    return toRun(response.insert_minerva_mail_cluster_runs_one);
  }

  /**
   * Stores a building run's clusters, by number; a label named by its
   * full name. A label's cluster whose label the account no longer has is
   * left out, as are its counts; so is a count for an unknown label.
   *
   * @throws NotFoundException no such run
   * @throws ConflictException the run is published
   */
  async createClusters(
    runId: string,
    request: CreateMailClustersRequest,
  ): Promise<CreateMailClusterItemsResponse> {
    requireId(runId, "runId");
    const clusters = request?.clusters;
    if (
      !Array.isArray(clusters) ||
      clusters.length < 1 ||
      clusters.length > MAX_CLUSTERS
    ) {
      throw new BadRequestException(
        `clusters must be 1 to ${MAX_CLUSTERS} clusters`,
      );
    }
    clusters.forEach((c, i) => validateCluster(c, i));
    const run = await this.requireBuilding(runId);
    const names = [
      ...new Set(
        clusters.flatMap((c) => [
          ...(c.scopeLabel ? [c.scopeLabel] : []),
          ...c.labels.map((l) => l.label),
        ]),
      ),
    ];
    const labels = await this.labelIds(run.accountId, names);
    let skipped = 0;
    const rows = clusters.flatMap((c) => {
      const scopeLabelId = c.scopeLabel ? labels.get(c.scopeLabel) : undefined;
      if (c.scope === MailClusterScope.Label && !scopeLabelId) {
        skipped++;
        return [];
      }
      return [
        {
          runId,
          number: c.number,
          scope: c.scope,
          ...(scopeLabelId ? { scopeLabelId } : {}),
          name: c.name,
          size: c.size,
          purity: Math.round(c.purity * 1000) / 1000,
          x: c.x,
          y: c.y,
          ...(c.suggestion
            ? { suggestion: c.suggestion, proposedName: c.proposedName }
            : {}),
          labels: {
            data: c.labels.flatMap((l) => {
              const labelId = labels.get(l.label);
              return labelId ? [{ labelId, messages: l.messages }] : [];
            }),
          },
          senders: {
            data: c.senders.map((s) => ({
              sender: s.sender,
              messages: s.messages,
            })),
          },
        },
      ];
    });
    if (rows.length) {
      const mutation = gql`
        mutation CreateMailClusters(
          $clusters: [minerva_mail_clusters_insert_input!]!
        ) {
          insert_minerva_mail_clusters(objects: $clusters) {
            affected_rows
          }
        }
      `;
      try {
        await this.graphQLClient.request(mutation, { clusters: rows });
      } catch (error) {
        if (/mail_clusters_run_id_number_key/.test(String(error))) {
          throw new ConflictException("A cluster number is in the run already");
        }
        throw error;
      }
    }
    return { created: rows.length, skipped };
  }

  /**
   * Stores a cluster's messages, by Gmail ID; one the account does not
   * have is left out and counted.
   *
   * @throws NotFoundException no such run, or no such cluster in it
   */
  async createMembers(
    runId: string,
    request: CreateMailClusterMembersRequest,
  ): Promise<CreateMailClusterItemsResponse> {
    requireId(runId, "runId");
    if (!Number.isInteger(request?.cluster) || request.cluster < 0) {
      throw new BadRequestException("cluster must be a cluster's number");
    }
    const gmailIds = requireGmailIds(request.gmailIds);
    const run = await this.requireBuilding(runId);
    const query = gql`
      query DescribeMailClusterForMembers(
        $runId: uuid!
        $number: Int!
        $accountId: uuid!
        $gmailIds: [String!]!
      ) {
        minerva_mail_clusters(
          where: { runId: { _eq: $runId }, number: { _eq: $number } }
        ) {
          id
        }
        minerva_mail_messages(
          where: { accountId: { _eq: $accountId }, gmailId: { _in: $gmailIds } }
        ) {
          id
        }
      }
    `;
    const found = await this.graphQLClient.request<{
      minerva_mail_clusters: { id: string }[];
      minerva_mail_messages: { id: string }[];
    }>(query, {
      runId,
      number: request.cluster,
      accountId: run.accountId,
      gmailIds,
    });
    const cluster = found.minerva_mail_clusters[0];
    if (!cluster) {
      throw new NotFoundException(
        `No cluster ${request.cluster} in run ${runId}`,
      );
    }
    const rows = found.minerva_mail_messages.map((m) => ({
      clusterId: cluster.id,
      messageId: m.id,
    }));
    if (rows.length) {
      const mutation = gql`
        mutation CreateMailClusterMembers(
          $members: [minerva_mail_cluster_members_insert_input!]!
        ) {
          insert_minerva_mail_cluster_members(
            objects: $members
            on_conflict: {
              constraint: mail_cluster_members_pkey
              update_columns: []
            }
          ) {
            affected_rows
          }
        }
      `;
      await this.graphQLClient.request(mutation, { members: rows });
    }
    return { created: rows.length, skipped: gmailIds.length - rows.length };
  }

  /**
   * Stores the map's points, by Gmail ID, each in its cluster by number;
   * a message the account does not have is left out and counted.
   *
   * @throws NotFoundException no such run
   */
  async createPoints(
    runId: string,
    request: CreateMailClusterPointsRequest,
  ): Promise<CreateMailClusterItemsResponse> {
    requireId(runId, "runId");
    const points = request?.points;
    if (
      !Array.isArray(points) ||
      points.length < 1 ||
      points.length > MAX_CLUSTER_ITEMS
    ) {
      throw new BadRequestException(
        `points must be 1 to ${MAX_CLUSTER_ITEMS} points`,
      );
    }
    points.forEach((p, i) => {
      if (
        !p ||
        typeof p.gmailId !== "string" ||
        !GMAIL_ID.test(p.gmailId) ||
        !unit(p.x) ||
        !unit(p.y) ||
        (p.cluster !== undefined &&
          (!Number.isInteger(p.cluster) || p.cluster < 0))
      ) {
        throw new BadRequestException(
          `points[${i}] must have a Gmail ID, x and y from 0 to 1, and a cluster number if any`,
        );
      }
    });
    const run = await this.requireBuilding(runId);
    const query = gql`
      query DescribeMailClusterPointTargets(
        $runId: uuid!
        $accountId: uuid!
        $gmailIds: [String!]!
      ) {
        minerva_mail_clusters(where: { runId: { _eq: $runId } }) {
          id
          number
        }
        minerva_mail_messages(
          where: { accountId: { _eq: $accountId }, gmailId: { _in: $gmailIds } }
        ) {
          id
          gmailId
        }
      }
    `;
    const found = await this.graphQLClient.request<{
      minerva_mail_clusters: { id: string; number: number }[];
      minerva_mail_messages: { id: string; gmailId: string }[];
    }>(query, {
      runId,
      accountId: run.accountId,
      gmailIds: [...new Set(points.map((p) => p.gmailId))],
    });
    const clusters = new Map(
      found.minerva_mail_clusters.map((c) => [c.number, c.id]),
    );
    const messages = new Map(
      found.minerva_mail_messages.map((m) => [m.gmailId, m.id]),
    );
    const rows = new Map<string, Record<string, unknown>>();
    for (const p of points) {
      const messageId = messages.get(p.gmailId);
      if (!messageId) continue;
      const clusterId =
        p.cluster !== undefined ? clusters.get(p.cluster) : undefined;
      rows.set(messageId, {
        runId,
        messageId,
        x: p.x,
        y: p.y,
        ...(clusterId ? { clusterId } : {}),
      });
    }
    if (rows.size) {
      const mutation = gql`
        mutation CreateMailClusterPoints(
          $points: [minerva_mail_cluster_points_insert_input!]!
        ) {
          insert_minerva_mail_cluster_points(
            objects: $points
            on_conflict: {
              constraint: mail_cluster_points_pkey
              update_columns: [x, y, clusterId]
            }
          ) {
            affected_rows
          }
        }
      `;
      await this.graphQLClient.request(mutation, {
        points: [...rows.values()],
      });
    }
    return { created: rows.size, skipped: points.length - rows.size };
  }

  /**
   * Publishes a building run: it becomes the account's, and the runs before
   * it are dropped, in one transaction.
   *
   * @throws NotFoundException no such run
   * @throws ConflictException it is published already
   */
  async publish(
    runId: string,
    request: PublishMailClusterRunRequest,
  ): Promise<MailClusterRun> {
    requireId(runId, "runId");
    const messages = request?.messages;
    if (!Number.isInteger(messages) || messages < 0) {
      throw new BadRequestException(
        "messages must be a whole number, 0 or more",
      );
    }
    const run = await this.requireBuilding(runId);
    const mutation = gql`
      mutation PublishMailClusterRun(
        $runId: uuid!
        $accountId: uuid!
        $messages: Int!
        $now: timestamptz!
      ) {
        update_minerva_mail_cluster_runs_by_pk(
          pk_columns: { id: $runId }
          _set: { status: "ready", finishedTime: $now, messages: $messages }
        ) {
          ${RUN_FIELDS}
        }
        delete_minerva_mail_cluster_runs(
          where: { accountId: { _eq: $accountId }, id: { _neq: $runId } }
        ) {
          affected_rows
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_minerva_mail_cluster_runs_by_pk: GraphQlRun;
    }>(mutation, {
      runId,
      accountId: run.accountId,
      messages,
      now: new Date().toISOString(),
    });
    return toRun(response.update_minerva_mail_cluster_runs_by_pk);
  }

  /**
   * The user's newest published run, of one account or of any: its
   * clusters, largest first, and the map.
   *
   * @throws BadRequestException accountId is not an ID
   */
  async map(
    userId: string,
    accountId?: string,
  ): Promise<GetMailClusterMapResponse> {
    if (accountId !== undefined) requireId(accountId, "accountId");
    const query = gql`
      query GetMailClusterMap($where: minerva_mail_cluster_runs_bool_exp!) {
        minerva_mail_cluster_runs(
          where: $where
          order_by: { finishedTime: desc }
          limit: 1
        ) {
          ${RUN_FIELDS}
          clusters(order_by: { size: desc }) {
            ${CLUSTER_FIELDS}
          }
          points {
            x
            y
            clusterId
            message {
              gmailId
              messageLabels(
                where: { label: { type: { _eq: "user" } } }
                order_by: { label: { name: asc } }
                limit: 1
              ) {
                label {
                  name
                }
              }
            }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_cluster_runs: (GraphQlRun & {
        clusters: GraphQlCluster[];
        points: {
          x: number;
          y: number;
          clusterId: string | null;
          message: {
            gmailId: string;
            messageLabels: { label: { name: string } }[];
          };
        }[];
      })[];
    }>(query, {
      where: {
        status: { _eq: MailClusterRunStatus.Ready },
        account: { userId: { _eq: userId } },
        ...(accountId ? { accountId: { _eq: accountId } } : {}),
      },
    });
    const run = response.minerva_mail_cluster_runs[0];
    if (!run) return { clusters: [], points: [] };
    return {
      run: toRun(run),
      clusters: run.clusters.map(toCluster),
      points: run.points.map((p) => ({
        gmailId: p.message.gmailId,
        x: p.x,
        y: p.y,
        ...(p.clusterId ? { clusterId: p.clusterId } : {}),
        ...(p.message.messageLabels[0]
          ? { label: p.message.messageLabels[0].label.name }
          : {}),
      })),
    };
  }

  /**
   * A cluster of the user's, with its newest messages' metadata.
   *
   * @throws NotFoundException no such cluster of the user's
   */
  async describe(
    userId: string,
    clusterId: string,
  ): Promise<DescribeMailClusterResponse> {
    requireId(clusterId, "clusterId");
    const query = gql`
      query DescribeMailCluster($clusterId: uuid!, $userId: uuid!) {
        minerva_mail_clusters(
          where: {
            id: { _eq: $clusterId }
            run: { account: { userId: { _eq: $userId } } }
          }
        ) {
          ${CLUSTER_FIELDS}
          members(
            order_by: { message: { receivedTime: desc } }
            limit: 20
          ) {
            message {
              gmailId
              fromAddress
              subject
              receivedTime
              messageLabels(where: { label: { type: { _eq: "user" } } }) {
                label {
                  name
                }
              }
            }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_clusters: (GraphQlCluster & {
        members: {
          message: {
            gmailId: string;
            fromAddress: string | null;
            subject: string | null;
            receivedTime: string;
            messageLabels: { label: { name: string } }[];
          };
        }[];
      })[];
    }>(query, { clusterId, userId });
    const cluster = response.minerva_mail_clusters[0];
    if (!cluster) throw new NotFoundException(`No cluster ${clusterId}`);
    return {
      cluster: toCluster(cluster),
      messages: cluster.members.map(({ message: m }) => ({
        gmailId: m.gmailId,
        ...(m.fromAddress ? { fromAddress: m.fromAddress } : {}),
        ...(m.subject ? { subject: m.subject } : {}),
        receivedTime: moment(m.receivedTime),
        labels: m.messageLabels.map((l) => l.label.name).sort(),
      })),
    };
  }

  /**
   * A page of a cluster's messages, by Gmail ID: what applying its
   * suggestion changes.
   *
   * @throws NotFoundException no such cluster of the user's
   */
  async members(
    userId: string,
    clusterId: string,
    offset: number,
    limit: number,
  ): Promise<ListMailClusterMembersResponse> {
    requireId(clusterId, "clusterId");
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException("offset must not be negative");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MEMBER_PAGE) {
      throw new BadRequestException(
        `limit must be between 1 and ${MAX_MEMBER_PAGE}`,
      );
    }
    const query = gql`
      query ListMailClusterMembers(
        $clusterId: uuid!
        $userId: uuid!
        $offset: Int!
        $limit: Int!
      ) {
        minerva_mail_clusters(
          where: {
            id: { _eq: $clusterId }
            run: { account: { userId: { _eq: $userId } } }
          }
        ) {
          id
          members_aggregate {
            aggregate {
              count
            }
          }
          members(
            order_by: { messageId: asc }
            offset: $offset
            limit: $limit
          ) {
            message {
              gmailId
            }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_clusters: {
        id: string;
        members_aggregate: { aggregate: { count: number } };
        members: { message: { gmailId: string } }[];
      }[];
    }>(query, { clusterId, userId, offset, limit });
    const cluster = response.minerva_mail_clusters[0];
    if (!cluster) throw new NotFoundException(`No cluster ${clusterId}`);
    return {
      gmailIds: cluster.members.map((m) => m.message.gmailId),
      count: cluster.members_aggregate.aggregate.count,
    };
  }

  /**
   * The user's clusters that suggest something (a new label, or a split),
   * from the newest runs, largest first; with `label`, the splits of that
   * label only.
   */
  async suggestions(userId: string, label?: string): Promise<MailCluster[]> {
    if (label !== undefined && (label.length < 1 || label.length > 225)) {
      throw new BadRequestException("label must be 1 to 225 characters");
    }
    const query = gql`
      query ListMailClusterSuggestions($where: minerva_mail_clusters_bool_exp!) {
        minerva_mail_clusters(where: $where, order_by: { size: desc }) {
          ${CLUSTER_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_clusters: GraphQlCluster[];
    }>(query, {
      where: {
        suggestion: label
          ? { _eq: MailClusterSuggestion.Split }
          : { _is_null: false },
        run: {
          status: { _eq: MailClusterRunStatus.Ready },
          account: { userId: { _eq: userId } },
        },
        ...(label ? { scopeLabel: { name: { _eq: label } } } : {}),
      },
    });
    return response.minerva_mail_clusters.map(toCluster);
  }

  private async labelIds(
    accountId: string,
    names: string[],
  ): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    for (const chunk of chunks(names)) {
      const query = gql`
        query ListMailClusterLabels($accountId: uuid!, $names: [String!]!) {
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
      }>(query, { accountId, names: chunk });
      for (const l of response.minerva_mail_labels) found.set(l.name, l.id);
    }
    return found;
  }

  private async requireBuilding(runId: string): Promise<GraphQlRun> {
    const query = gql`
      query DescribeMailClusterRun($runId: uuid!) {
        minerva_mail_cluster_runs_by_pk(id: $runId) {
          ${RUN_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_cluster_runs_by_pk: GraphQlRun | null;
    }>(query, { runId });
    const run = response.minerva_mail_cluster_runs_by_pk;
    if (!run) throw new NotFoundException(`No cluster run ${runId}`);
    if (run.status !== MailClusterRunStatus.Building) {
      throw new ConflictException(`Cluster run ${runId} is published`);
    }
    return run;
  }
}

const requireGmailIds = (ids: unknown): string[] => {
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > MAX_CLUSTER_ITEMS ||
    !ids.every((id) => typeof id === "string" && GMAIL_ID.test(id))
  ) {
    throw new BadRequestException(
      `gmailIds must be 1 to ${MAX_CLUSTER_ITEMS} Gmail message IDs`,
    );
  }
  return [...new Set(ids as string[])];
};

const name = (value: unknown, max: number): boolean =>
  typeof value === "string" && value.length >= 1 && value.length <= max;

const validateCluster = (c: NewMailCluster, i: number): void => {
  const at = `clusters[${i}]`;
  const bad = (what: string) => new BadRequestException(`${at}.${what}`);
  if (!c || typeof c !== "object") throw bad("must be a cluster");
  if (!Number.isInteger(c.number) || c.number < 0) {
    throw bad("number must be a whole number, 0 or more");
  }
  if (!Object.values(MailClusterScope).includes(c.scope)) {
    throw bad("scope must be unlabelled or label");
  }
  if ((c.scope === MailClusterScope.Label) !== name(c.scopeLabel, 225)) {
    throw bad("scopeLabel names the label of a label's cluster, and only then");
  }
  if (!name(c.name, 300)) throw bad("name must be 1 to 300 characters");
  if (!Number.isInteger(c.size) || c.size < 0) {
    throw bad("size must be a whole number, 0 or more");
  }
  if (!unit(c.purity) || !unit(c.x) || !unit(c.y)) {
    throw bad("purity, x and y must be from 0 to 1");
  }
  if (c.suggestion !== undefined) {
    const fits =
      (c.suggestion === MailClusterSuggestion.NewLabel &&
        c.scope === MailClusterScope.Unlabelled) ||
      (c.suggestion === MailClusterSuggestion.Split &&
        c.scope === MailClusterScope.Label);
    if (!fits || !name(c.proposedName, 225)) {
      throw bad(
        "suggestion must be new-label for unlabelled mail or split for a label's, with its proposedName",
      );
    }
  } else if (c.proposedName !== undefined) {
    throw bad("proposedName comes with a suggestion");
  }
  if (
    !Array.isArray(c.labels) ||
    c.labels.length > 10 ||
    !c.labels.every(
      (l) =>
        l &&
        name(l.label, 225) &&
        Number.isInteger(l.messages) &&
        l.messages >= 0,
    )
  ) {
    throw bad("labels must be up to 10 labels with their messages");
  }
  if (
    !Array.isArray(c.senders) ||
    c.senders.length > 10 ||
    !c.senders.every(
      (s) =>
        s &&
        name(s.sender, 1024) &&
        Number.isInteger(s.messages) &&
        s.messages >= 0,
    )
  ) {
    throw bad("senders must be up to 10 senders with their messages");
  }
};
