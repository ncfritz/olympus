import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { ApiTimestamp } from "../../decorators";

/* ------------------------------------------------------------------------------------------------------------------ */
/* Enums                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/** What a cluster groups: unlabelled mail, or one label's mail. */
export enum MailClusterScope {
  Unlabelled = "unlabelled",
  Label = "label",
}

/** What a cluster suggests. */
export enum MailClusterSuggestion {
  /** A label for a group of unlabelled mail from a tight set of senders. */
  NewLabel = "new-label",
  /** A sub-label for one group of a label whose mail falls into groups. */
  Split = "split",
}

export enum MailClusterRunStatus {
  Building = "building",
  Ready = "ready",
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** A run of the classifier's clustering over one mailbox. */
export class MailClusterRun {
  @ApiProperty({ type: String, required: true, description: "The run's ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account clustered",
  })
  accountId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The embeddings it grouped by",
  })
  embeddingVersion: string;

  @ApiProperty({
    enum: () => MailClusterRunStatus,
    enumName: "MailClusterRunStatus",
    enumSchema: { description: "Whether a cluster run is building or ready" },
    required: true,
    description:
      "Building while the classifier posts to it; ready once published",
  })
  status: MailClusterRunStatus;

  @ApiTimestamp({ required: true, description: "When the run began" })
  startedTime: Moment;

  @ApiTimestamp({ required: false, description: "When it was published" })
  finishedTime?: Moment;

  @ApiProperty({
    type: Number,
    required: false,
    description: "Messages with a vector, that it clustered",
  })
  messages?: number;
}

/** A label among a cluster's messages, and how many have it. */
export class MailClusterLabelCount {
  @ApiProperty({ type: String, required: true, description: "The label" })
  label: string;

  @ApiProperty({ type: Number, required: true, description: "Its messages" })
  messages: number;
}

/** A sender among a cluster's messages, and how many it sent. */
export class MailClusterSenderCount {
  @ApiProperty({ type: String, required: true, description: "The address" })
  sender: string;

  @ApiProperty({ type: Number, required: true, description: "Its messages" })
  messages: number;
}

/** A group of messages near one another by embedding. */
export class MailCluster {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account",
  })
  accountId: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Its number within the run",
  })
  number: number;

  @ApiProperty({
    enum: () => MailClusterScope,
    enumName: "MailClusterScope",
    enumSchema: {
      description: "What a cluster groups: unlabelled mail, or one label's",
    },
    required: true,
    description: "What it groups",
  })
  scope: MailClusterScope;

  @ApiProperty({
    type: String,
    required: false,
    description: "For a label's cluster, the label",
  })
  scopeLabel?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "A name from its labels or senders",
  })
  name: string;

  @ApiProperty({ type: Number, required: true, description: "Its messages" })
  size: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The share of its messages with its most common label, 0 to 1",
  })
  purity: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Where it sits on the map, 0 to 1 across",
  })
  x: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "Where it sits on the map, 0 to 1 down",
  })
  y: number;

  @ApiProperty({
    enum: () => MailClusterSuggestion,
    enumName: "MailClusterSuggestion",
    enumSchema: { description: "What a cluster suggests" },
    required: false,
    description: "What it suggests, if anything",
  })
  suggestion?: MailClusterSuggestion;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The label it proposes, by full name: new, or a sub-label of its label",
  })
  proposedName?: string;

  @ApiProperty({
    type: () => MailClusterLabelCount,
    isArray: true,
    required: true,
    description: "Its most common labels, most first",
  })
  labels: MailClusterLabelCount[];

  @ApiProperty({
    type: () => MailClusterSenderCount,
    isArray: true,
    required: true,
    description: "Its top senders, most first",
  })
  senders: MailClusterSenderCount[];
}

/** A message on the map. */
export class MailClusterPoint {
  @ApiProperty({ type: String, required: true, description: "Its Gmail ID" })
  gmailId: string;

  @ApiProperty({ type: Number, required: true, description: "0 to 1 across" })
  x: number;

  @ApiProperty({ type: Number, required: true, description: "0 to 1 down" })
  y: number;

  @ApiProperty({
    type: String,
    required: false,
    description: "The cluster it is in, if any",
  })
  clusterId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "Its first user label now, for colour; none when unlabelled",
  })
  label?: string;
}

/** A cluster's message, as the side panel lists it: metadata only. */
export class MailClusterMessage {
  @ApiProperty({ type: String, required: true, description: "Its Gmail ID" })
  gmailId: string;

  @ApiProperty({ type: String, required: false, description: "The sender" })
  fromAddress?: string;

  @ApiProperty({ type: String, required: false, description: "The subject" })
  subject?: string;

  @ApiTimestamp({ required: true, description: "When it was received" })
  receivedTime: Moment;

  @ApiProperty({
    type: [String],
    required: true,
    description: "Its user labels now",
  })
  labels: string[];
}

/** A cluster as the classifier posts it. */
export class NewMailCluster {
  @ApiProperty({ type: Number, required: true, description: "Its number" })
  number: number;

  @ApiProperty({
    enum: () => MailClusterScope,
    enumName: "MailClusterScope",
    enumSchema: {
      description: "What a cluster groups: unlabelled mail, or one label's",
    },
    required: true,
    description: "What it groups",
  })
  scope: MailClusterScope;

  @ApiProperty({
    type: String,
    required: false,
    description: "For a label's cluster, the label's full name",
  })
  scopeLabel?: string;

  @ApiProperty({ type: String, required: true, description: "Its name" })
  name: string;

  @ApiProperty({ type: Number, required: true, description: "Its messages" })
  size: number;

  @ApiProperty({ type: Number, required: true, description: "0 to 1" })
  purity: number;

  @ApiProperty({ type: Number, required: true, description: "0 to 1" })
  x: number;

  @ApiProperty({ type: Number, required: true, description: "0 to 1" })
  y: number;

  @ApiProperty({
    enum: () => MailClusterSuggestion,
    enumName: "MailClusterSuggestion",
    enumSchema: { description: "What a cluster suggests" },
    required: false,
    description: "What it suggests",
  })
  suggestion?: MailClusterSuggestion;

  @ApiProperty({
    type: String,
    required: false,
    description: "The label it proposes",
  })
  proposedName?: string;

  @ApiProperty({
    type: () => MailClusterLabelCount,
    isArray: true,
    required: true,
    description: "Up to 10 labels",
  })
  labels: MailClusterLabelCount[];

  @ApiProperty({
    type: () => MailClusterSenderCount,
    isArray: true,
    required: true,
    description: "Up to 10 senders",
  })
  senders: MailClusterSenderCount[];
}

/** A message on the map, as the classifier posts it. */
export class NewMailClusterPoint {
  @ApiProperty({ type: String, required: true, description: "Its Gmail ID" })
  gmailId: string;

  @ApiProperty({ type: Number, required: true, description: "0 to 1" })
  x: number;

  @ApiProperty({ type: Number, required: true, description: "0 to 1" })
  y: number;

  @ApiProperty({
    type: Number,
    required: false,
    description: "The number of the cluster it is in, if any",
  })
  cluster?: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateMailClusterRunRequest {
  @ApiProperty({
    type: String,
    required: true,
    description: "The mail account",
  })
  accountId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The embeddings it groups by",
  })
  embeddingVersion: string;
}

export class CreateMailClustersRequest {
  @ApiProperty({
    type: () => NewMailCluster,
    isArray: true,
    required: true,
    description: "Up to 500 clusters",
  })
  clusters: NewMailCluster[];
}

export class CreateMailClusterMembersRequest {
  @ApiProperty({
    type: Number,
    required: true,
    description: "The cluster, by number",
  })
  cluster: number;

  @ApiProperty({
    type: [String],
    required: true,
    description: "Up to 5,000 of its messages by Gmail ID",
  })
  gmailIds: string[];
}

export class CreateMailClusterPointsRequest {
  @ApiProperty({
    type: () => NewMailClusterPoint,
    isArray: true,
    required: true,
    description: "Up to 5,000 points",
  })
  points: NewMailClusterPoint[];
}

export class PublishMailClusterRunRequest {
  @ApiProperty({
    type: Number,
    required: true,
    description: "Messages with a vector, that the run clustered",
  })
  messages: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateMailClusterRunResponse {
  @ApiProperty({
    type: () => MailClusterRun,
    required: true,
    description: "The run, building",
  })
  run: MailClusterRun;
}

export class PublishMailClusterRunResponse {
  @ApiProperty({
    type: () => MailClusterRun,
    required: true,
    description: "The run, published",
  })
  run: MailClusterRun;
}

export class CreateMailClusterItemsResponse {
  @ApiProperty({ type: Number, required: true, description: "Stored" })
  created: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "Left out: a message the account does not have, or a cluster or label it does not",
  })
  skipped: number;
}

export class GetMailClusterMapResponse {
  @ApiProperty({
    type: () => MailClusterRun,
    required: false,
    description: "The newest published run; absent before the first",
  })
  run?: MailClusterRun;

  @ApiProperty({
    type: () => MailCluster,
    isArray: true,
    required: true,
    description: "Its clusters, largest first",
  })
  clusters: MailCluster[];

  @ApiProperty({
    type: () => MailClusterPoint,
    isArray: true,
    required: true,
    description: "The map's points",
  })
  points: MailClusterPoint[];
}

export class DescribeMailClusterResponse {
  @ApiProperty({
    type: () => MailCluster,
    required: true,
    description: "The cluster",
  })
  cluster: MailCluster;

  @ApiProperty({
    type: () => MailClusterMessage,
    isArray: true,
    required: true,
    description: "Its newest messages, up to 20",
  })
  messages: MailClusterMessage[];
}

export class ListMailClusterMembersResponse {
  @ApiProperty({
    type: [String],
    required: true,
    description: "A page of its messages' Gmail IDs",
  })
  gmailIds: string[];

  @ApiProperty({
    type: Number,
    required: true,
    description: "All its messages",
  })
  count: number;
}

export class ListMailClusterSuggestionsResponse {
  @ApiProperty({
    type: () => MailCluster,
    isArray: true,
    required: true,
    description: "Clusters that suggest something, largest first",
  })
  clusters: MailCluster[];
}
