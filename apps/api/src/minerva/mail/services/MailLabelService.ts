import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateMailLabelFamilyRequest,
  MailLabel,
  MailLabelFamily,
  MailLabelKind,
  UpdateMailLabelRequest,
} from "@ncfritz/olympus-model";
import { randomUUID } from "crypto";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlMailLabel,
  GraphQlMailLabelFamily,
  toFamily,
  toLabel,
} from "../converters/MailLabelConverter";

const LABEL_FIELDS = `
  id
  accountId
  name
  type
  kind
  familyId
  stateOpen
  mergeTargetId
  family {
    name
  }
  mergeTarget {
    name
  }
`;

const FAMILY_FIELDS = `
  id
  accountId
  name
  initialLabelId
  states(order_by: { name: asc }) {
    id
    name
    stateOpen
  }
  transitions {
    fromLabelId
    toLabelId
  }
`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requireId = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new BadRequestException(`${name} must be a label ID`);
  }
  return value;
};

/**
 * Label kinds and families (ADR 0030, Label kinds; docs/plans/
 * email-management phase 3). A label is topical or retired by its own
 * setting, and a state by being one of a family's: a family is created
 * with its states and deleted to give them back, so a state and its
 * family never disagree. Every label read and written is the caller's.
 */
@Injectable()
export class MailLabelService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  async list(userId: string): Promise<MailLabel[]> {
    const query = gql`
      query ListMailLabels($userId: uuid!) {
        minerva_mail_labels(
          where: { account: { userId: { _eq: $userId } } }
          order_by: [{ name: asc }, { accountId: asc }]
        ) {
          ${LABEL_FIELDS}
          messageLabels_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_labels: GraphQlMailLabel[];
    }>(query, { userId });
    return response.minerva_mail_labels.map(toLabel);
  }

  /**
   * Makes a label topical, or retired into another.
   *
   * @throws NotFoundException the label, or the target, is not the caller's
   * @throws ConflictException the label is a state, or the merge would chain
   */
  async update(
    userId: string,
    labelId: string,
    request: UpdateMailLabelRequest,
  ): Promise<MailLabel> {
    const kind = request?.kind;
    if (kind !== MailLabelKind.Topical && kind !== MailLabelKind.Retired) {
      throw new BadRequestException(
        "kind must be topical or retired; a label becomes a state by joining a family",
      );
    }
    const target =
      kind === MailLabelKind.Retired
        ? requireId(request.mergeTargetId, "mergeTargetId")
        : undefined;
    if (kind === MailLabelKind.Topical && request.mergeTargetId !== undefined) {
      throw new BadRequestException("A topical label has no merge target");
    }

    const ids = target ? [labelId, target] : [labelId];
    const labels = await this.labelsById(userId, ids);
    const label = labels.get(labelId);
    if (!label) throw new NotFoundException(`No label ${labelId}`);
    if (label.kind === MailLabelKind.System) {
      throw new BadRequestException("A system label's kind is fixed");
    }
    if (label.kind === MailLabelKind.State) {
      throw new ConflictException(
        `${label.name} is a state of ${label.family?.name}; delete the family first`,
      );
    }
    if (target) {
      const into = labels.get(target);
      if (!into) throw new NotFoundException(`No label ${target}`);
      if (target === labelId) {
        throw new BadRequestException("A label cannot be merged into itself");
      }
      if (into.accountId !== label.accountId) {
        throw new BadRequestException(
          "A label merges only into one of its own account's",
        );
      }
      if (
        into.kind === MailLabelKind.System ||
        into.kind === MailLabelKind.Retired
      ) {
        throw new ConflictException(
          `${into.name} is ${into.kind}; merge into a label that is not`,
        );
      }
      if (await this.isMergeTarget(labelId)) {
        throw new ConflictException(
          `Other labels merge into ${label.name}; it cannot be retired itself`,
        );
      }
    }

    const mutation = gql`
      mutation UpdateMailLabel($id: uuid!, $kind: String!, $target: uuid) {
        update_minerva_mail_labels_by_pk(
          pk_columns: { id: $id }
          _set: { kind: $kind, mergeTargetId: $target }
        ) {
          ${LABEL_FIELDS}
          messageLabels_aggregate {
            aggregate {
              count
            }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_minerva_mail_labels_by_pk: GraphQlMailLabel;
    }>(mutation, { id: labelId, kind, target: target ?? null });
    return toLabel(response.update_minerva_mail_labels_by_pk);
  }

  async listFamilies(userId: string): Promise<MailLabelFamily[]> {
    const query = gql`
      query ListMailLabelFamilies($userId: uuid!) {
        minerva_mail_label_families(
          where: { account: { userId: { _eq: $userId } } }
          order_by: { name: asc }
        ) {
          ${FAMILY_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_label_families: GraphQlMailLabelFamily[];
    }>(query, { userId });
    return response.minerva_mail_label_families.map(toFamily);
  }

  /**
   * A family of the caller's topical labels, which become its states.
   *
   * @throws NotFoundException a label is not the caller's
   * @throws ConflictException a label is not topical, or the name is taken
   */
  async createFamily(
    userId: string,
    request: CreateMailLabelFamilyRequest,
  ): Promise<MailLabelFamily> {
    const name = typeof request?.name === "string" ? request.name.trim() : "";
    if (name.length < 1 || name.length > 100) {
      throw new BadRequestException("name must be 1 to 100 characters");
    }
    if (!Array.isArray(request.states) || request.states.length < 2) {
      throw new BadRequestException("A family needs two states or more");
    }
    const states = request.states.map((s, i) => {
      if (typeof s?.open !== "boolean") {
        throw new BadRequestException(
          `states[${i}].open must be true or false`,
        );
      }
      return {
        labelId: requireId(s.labelId, `states[${i}].labelId`),
        open: s.open,
      };
    });
    const stateIds = new Set(states.map((s) => s.labelId));
    if (stateIds.size !== states.length) {
      throw new BadRequestException("A label is one state only once");
    }
    const initial = requireId(request.initialLabelId, "initialLabelId");
    if (!stateIds.has(initial)) {
      throw new BadRequestException("initialLabelId must be one of the states");
    }
    if (!states.find((s) => s.labelId === initial)!.open) {
      throw new BadRequestException("The initial state must be open");
    }
    if (!Array.isArray(request.transitions)) {
      throw new BadRequestException("transitions must be a list");
    }
    const transitions = request.transitions.map((t, i) => {
      const from = requireId(t?.fromLabelId, `transitions[${i}].fromLabelId`);
      const to = requireId(t?.toLabelId, `transitions[${i}].toLabelId`);
      if (!stateIds.has(from) || !stateIds.has(to) || from === to) {
        throw new BadRequestException(
          `transitions[${i}] must move between two of the family's states`,
        );
      }
      return { from, to };
    });

    const labels = await this.labelsById(userId, [...stateIds]);
    const accountIds = new Set<string>();
    for (const id of stateIds) {
      const label = labels.get(id);
      if (!label) throw new NotFoundException(`No label ${id}`);
      if (label.kind !== MailLabelKind.Topical) {
        throw new ConflictException(
          `${label.name} is ${label.kind}; only a topical label can become a state`,
        );
      }
      accountIds.add(label.accountId);
    }
    if (accountIds.size !== 1) {
      throw new BadRequestException("A family's states are one account's");
    }
    const accountId = [...accountIds][0];
    if (await this.familyNamed(accountId, name)) {
      throw new ConflictException(`There is a family named ${name} already`);
    }

    const id = randomUUID();
    const mutation = gql`
      mutation CreateMailLabelFamily(
        $family: minerva_mail_label_families_insert_input!
        $states: [minerva_mail_labels_updates!]!
        $transitions: [minerva_mail_label_transitions_insert_input!]!
      ) {
        insert_minerva_mail_label_families_one(object: $family) {
          id
        }
        update_minerva_mail_labels_many(updates: $states) {
          affected_rows
        }
        insert_minerva_mail_label_transitions(objects: $transitions) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      family: { id, accountId, name, initialLabelId: initial },
      states: states.map((s) => ({
        where: { id: { _eq: s.labelId } },
        _set: { kind: MailLabelKind.State, familyId: id, stateOpen: s.open },
      })),
      transitions: transitions.map((t) => ({
        familyId: id,
        fromLabelId: t.from,
        toLabelId: t.to,
      })),
    });
    return (await this.describeFamily(userId, id))!;
  }

  /**
   * Deletes a family, its states topical again.
   *
   * @throws NotFoundException the family is not the caller's
   */
  async deleteFamily(userId: string, familyId: string): Promise<void> {
    if (!(await this.describeFamily(userId, familyId))) {
      throw new NotFoundException(`No label family ${familyId}`);
    }
    const mutation = gql`
      mutation DeleteMailLabelFamily($familyId: uuid!) {
        update_minerva_mail_labels(
          where: { familyId: { _eq: $familyId } }
          _set: { kind: "topical", familyId: null, stateOpen: null }
        ) {
          affected_rows
        }
        delete_minerva_mail_label_families_by_pk(id: $familyId) {
          id
        }
      }
    `;
    await this.graphQLClient.request(mutation, { familyId });
  }

  /** The caller's family `familyId`, or undefined. */
  private async describeFamily(
    userId: string,
    familyId: string,
  ): Promise<MailLabelFamily | undefined> {
    const query = gql`
      query DescribeMailLabelFamily($userId: uuid!, $familyId: uuid!) {
        minerva_mail_label_families(
          where: {
            id: { _eq: $familyId }
            account: { userId: { _eq: $userId } }
          }
        ) {
          ${FAMILY_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_label_families: GraphQlMailLabelFamily[];
    }>(query, { userId, familyId });
    const family = response.minerva_mail_label_families[0];
    return family ? toFamily(family) : undefined;
  }

  private async labelsById(
    userId: string,
    ids: string[],
  ): Promise<Map<string, GraphQlMailLabel>> {
    const query = gql`
      query DescribeMailLabels($userId: uuid!, $ids: [uuid!]!) {
        minerva_mail_labels(
          where: {
            id: { _in: $ids }
            account: { userId: { _eq: $userId } }
          }
        ) {
          ${LABEL_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_labels: GraphQlMailLabel[];
    }>(query, { userId, ids });
    return new Map(response.minerva_mail_labels.map((l) => [l.id, l]));
  }

  private async isMergeTarget(labelId: string): Promise<boolean> {
    const query = gql`
      query DescribeMailLabelMerges($labelId: uuid!) {
        minerva_mail_labels(
          where: { mergeTargetId: { _eq: $labelId } }
          limit: 1
        ) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_labels: { id: string }[];
    }>(query, { labelId });
    return response.minerva_mail_labels.length > 0;
  }

  private async familyNamed(accountId: string, name: string): Promise<boolean> {
    const query = gql`
      query DescribeMailLabelFamilyByName($accountId: uuid!, $name: String!) {
        minerva_mail_label_families(
          where: { accountId: { _eq: $accountId }, name: { _eq: $name } }
        ) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_label_families: { id: string }[];
    }>(query, { accountId, name });
    return response.minerva_mail_label_families.length > 0;
  }
}
