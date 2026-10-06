import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateMailSuggestionRunRequest,
  CreateMailSuggestionsRequest,
  CreateMailSuggestionsResponse,
  MailAuditAction,
  MailSuggestionRun,
  MailSuggestionRunStatus,
  NewMailSuggestion,
  PublishMailSuggestionRunRequest,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";

export const MAX_SUGGESTIONS = 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GMAIL_ID = /^[0-9a-f]{1,16}$/;

const RUN_FIELDS = `
  id
  accountId
  modelRun
  featureVersion
  status
  startedTime
  finishedTime
  messagesScored
`;

type GraphQlRun = {
  id: string;
  accountId: string;
  modelRun: string;
  featureVersion: string;
  status: string;
  startedTime: string;
  finishedTime: string | null;
  messagesScored: number | null;
};

const toRun = (input: GraphQlRun): MailSuggestionRun => ({
  id: input.id,
  accountId: input.accountId,
  modelRun: input.modelRun,
  featureVersion: input.featureVersion,
  status: input.status as MailSuggestionRunStatus,
  startedTime: moment(input.startedTime),
  ...(input.finishedTime ? { finishedTime: moment(input.finishedTime) } : {}),
  ...(input.messagesScored !== null
    ? { messagesScored: input.messagesScored }
    : {}),
});

const text = (value: unknown, name: string, max: number): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    throw new BadRequestException(`${name} must be 1 to ${max} characters`);
  }
  return value;
};

const requireRunId = (runId: string): string => {
  if (!UUID.test(runId)) throw new BadRequestException("runId must be an ID");
  return runId;
};

/**
 * The classifier's suggestions over the whole mailbox (docs/plans/
 * email-management phase 4), posted by the classifier service: a run per
 * pass, filled in batches while it builds, then published, which makes
 * its suggestions the account's and drops the runs before it. For agents
 * only; the Re-classification page reads them through mail_proposals.
 */
@Injectable()
export class MailSuggestionService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * @throws BadRequestException a field is not what it should be
   * @throws NotFoundException no such account
   */
  async createRun(
    request: CreateMailSuggestionRunRequest,
  ): Promise<MailSuggestionRun> {
    const accountId = request?.accountId;
    if (typeof accountId !== "string" || !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a mail account ID");
    }
    const modelRun = text(request.modelRun, "modelRun", 100);
    const featureVersion = text(request.featureVersion, "featureVersion", 50);
    const query = gql`
      mutation CreateMailSuggestionRun($run: minerva_mail_suggestion_runs_insert_input!) {
        insert_minerva_mail_suggestion_runs_one(object: $run) {
          ${RUN_FIELDS}
        }
      }
    `;
    await this.requireAccount(accountId);
    const response = await this.graphQLClient.request<{
      insert_minerva_mail_suggestion_runs_one: GraphQlRun;
    }>(query, { run: { accountId, modelRun, featureVersion } });
    return toRun(response.insert_minerva_mail_suggestion_runs_one);
  }

  /**
   * Stores a batch of suggestions in a building run, by Gmail ID and label
   * name. A suggestion that does not fit the mailbox as it is now is left
   * out and counted: an unknown message or label, a label that is not the
   * user's own, adding a label the message has or removing one it lacks.
   *
   * @throws NotFoundException no such run
   * @throws ConflictException the run is published
   */
  async createSuggestions(
    runId: string,
    request: CreateMailSuggestionsRequest,
  ): Promise<CreateMailSuggestionsResponse> {
    requireRunId(runId);
    const suggestions = request?.suggestions;
    if (
      !Array.isArray(suggestions) ||
      suggestions.length < 1 ||
      suggestions.length > MAX_SUGGESTIONS
    ) {
      throw new BadRequestException(
        `suggestions must be 1 to ${MAX_SUGGESTIONS} suggestions`,
      );
    }
    suggestions.forEach((s, i) => validate(s, i));
    const run = await this.requireBuilding(runId);

    const gmailIds = [...new Set(suggestions.map((s) => s.gmailId))];
    const names = [...new Set(suggestions.map((s) => s.label))];
    const query = gql`
      query DescribeMailSuggestionTargets(
        $accountId: uuid!
        $gmailIds: [String!]!
        $names: [String!]!
      ) {
        minerva_mail_messages(
          where: { accountId: { _eq: $accountId }, gmailId: { _in: $gmailIds } }
        ) {
          id
          gmailId
          messageLabels {
            labelId
          }
        }
        minerva_mail_labels(
          where: {
            accountId: { _eq: $accountId }
            name: { _in: $names }
            type: { _eq: "user" }
          }
        ) {
          id
          name
        }
      }
    `;
    const found = await this.graphQLClient.request<{
      minerva_mail_messages: {
        id: string;
        gmailId: string;
        messageLabels: { labelId: string }[];
      }[];
      minerva_mail_labels: { id: string; name: string }[];
    }>(query, { accountId: run.accountId, gmailIds, names });
    const messages = new Map(
      found.minerva_mail_messages.map((m) => [
        m.gmailId,
        { id: m.id, labels: new Set(m.messageLabels.map((l) => l.labelId)) },
      ]),
    );
    const labels = new Map(
      found.minerva_mail_labels.map((l) => [l.name, l.id]),
    );

    // One row per message and label; a later one in the batch wins.
    const rows = new Map<string, Record<string, unknown>>();
    for (const s of suggestions) {
      const message = messages.get(s.gmailId);
      const labelId = labels.get(s.label);
      if (!message || !labelId) continue;
      const has = message.labels.has(labelId);
      if ((s.action === MailAuditAction.Add) === has) continue;
      rows.set(`${message.id}/${labelId}`, {
        runId,
        messageId: message.id,
        labelId,
        action: s.action,
        confidence: Math.round(s.confidence * 1000) / 1000,
        ticked: s.ticked,
      });
    }
    if (rows.size > 0) {
      const insert = gql`
        mutation CreateMailSuggestions(
          $suggestions: [minerva_mail_suggestions_insert_input!]!
        ) {
          insert_minerva_mail_suggestions(
            objects: $suggestions
            on_conflict: {
              constraint: mail_suggestions_pkey
              update_columns: [action, confidence, ticked]
            }
          ) {
            affected_rows
          }
        }
      `;
      await this.graphQLClient.request(insert, {
        suggestions: [...rows.values()],
      });
    }
    return { created: rows.size, skipped: suggestions.length - rows.size };
  }

  /**
   * Publishes a building run: its suggestions become the account's, and
   * the account's runs before it are dropped, in one transaction.
   *
   * @throws NotFoundException no such run
   * @throws ConflictException the run is published already
   */
  async publish(
    runId: string,
    request: PublishMailSuggestionRunRequest,
  ): Promise<MailSuggestionRun> {
    requireRunId(runId);
    const scored = request?.messagesScored;
    if (!Number.isInteger(scored) || scored < 0) {
      throw new BadRequestException(
        "messagesScored must be a whole number, 0 or more",
      );
    }
    const run = await this.requireBuilding(runId);
    const query = gql`
      mutation PublishMailSuggestionRun(
        $runId: uuid!
        $accountId: uuid!
        $scored: Int!
        $now: timestamptz!
      ) {
        update_minerva_mail_suggestion_runs_by_pk(
          pk_columns: { id: $runId }
          _set: { status: "ready", finishedTime: $now, messagesScored: $scored }
        ) {
          ${RUN_FIELDS}
        }
        delete_minerva_mail_suggestion_runs(
          where: { accountId: { _eq: $accountId }, id: { _neq: $runId } }
        ) {
          affected_rows
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_minerva_mail_suggestion_runs_by_pk: GraphQlRun;
    }>(query, {
      runId,
      accountId: run.accountId,
      scored,
      now: new Date().toISOString(),
    });
    return toRun(response.update_minerva_mail_suggestion_runs_by_pk);
  }

  private async requireBuilding(runId: string): Promise<GraphQlRun> {
    const query = gql`
      query DescribeMailSuggestionRun($runId: uuid!) {
        minerva_mail_suggestion_runs_by_pk(id: $runId) {
          ${RUN_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_suggestion_runs_by_pk: GraphQlRun | null;
    }>(query, { runId });
    const run = response.minerva_mail_suggestion_runs_by_pk;
    if (!run) throw new NotFoundException(`No suggestion run ${runId}`);
    if (run.status !== MailSuggestionRunStatus.Building) {
      throw new ConflictException(`Suggestion run ${runId} is published`);
    }
    return run;
  }

  private async requireAccount(accountId: string): Promise<void> {
    const query = gql`
      query DescribeMailSuggestionAccount($accountId: uuid!) {
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

const validate = (s: NewMailSuggestion, i: number): void => {
  const at = `suggestions[${i}]`;
  if (!s || typeof s !== "object") {
    throw new BadRequestException(`${at} must be a suggestion`);
  }
  if (typeof s.gmailId !== "string" || !GMAIL_ID.test(s.gmailId)) {
    throw new BadRequestException(`${at}.gmailId must be a Gmail message ID`);
  }
  if (
    typeof s.label !== "string" ||
    s.label.length < 1 ||
    s.label.length > 225
  ) {
    throw new BadRequestException(`${at}.label must be 1 to 225 characters`);
  }
  if (s.action !== MailAuditAction.Add && s.action !== MailAuditAction.Remove) {
    throw new BadRequestException(`${at}.action must be add or remove`);
  }
  if (
    typeof s.confidence !== "number" ||
    !(s.confidence >= 0 && s.confidence <= 1)
  ) {
    throw new BadRequestException(`${at}.confidence must be from 0 to 1`);
  }
  if (typeof s.ticked !== "boolean") {
    throw new BadRequestException(`${at}.ticked must be true or false`);
  }
};
