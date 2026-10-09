import { BaseTag, PartialTag, Tag } from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ClientError, gql, GraphQLClient } from "graphql-request";
import { GraphQlTag, toDomainObject } from "../converters/TagConverter";
import { TAG } from "../queries/tags";

const MAX_NAME = 50;
const COLOR = /^#[0-9a-f]{6}$/;

/**
 * A user's tags in Hasura (ADR 0026). Every method takes the caller's user
 * ID and scopes by it, so another user's tag is simply not found.
 */
@Injectable()
export class TagService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * The user's tags by name. With a prefix, only the names that start with
   * it, whatever their case: the tag picker's search.
   */
  async list(userId: string, prefix?: string): Promise<Tag[]> {
    const where: Record<string, unknown> = { userId: { _eq: userId } };
    const start = checkPrefix(prefix);
    if (start) where.name = { _ilike: `${escapeLike(start)}%` };

    const document = gql`
      query ListTags($where: minerva_tags_bool_exp!) {
        minerva_tags(where: $where, order_by: { name: asc }) {
          ${TAG}
        }
      }
    `;
    type Result = { minerva_tags: GraphQlTag[] };
    const result = await this.graphQLClient.request<Result>(document, {
      where,
    });
    return result.minerva_tags.map(toDomainObject);
  }

  /** One of the user's tags. */
  async describe(userId: string, tagId: string): Promise<Tag> {
    const document = gql`
      query DescribeTag($userId: uuid!, $tagId: uuid!) {
        minerva_tags(
          where: { id: { _eq: $tagId }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${TAG}
        }
      }
    `;
    type Result = { minerva_tags: GraphQlTag[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      tagId,
    });
    const row = result.minerva_tags[0];
    if (!row) throw notFound(tagId);
    return toDomainObject(row);
  }

  /** Adds a tag; a name the user already has, in any case, is a conflict. */
  async create(userId: string, tag: BaseTag | undefined): Promise<Tag> {
    const values = validateBase(tag);
    const document = gql`
      mutation CreateTag($object: minerva_tags_insert_input!) {
        insert_minerva_tags_one(object: $object) {
          ${TAG}
        }
      }
    `;
    type Result = { insert_minerva_tags_one: GraphQlTag };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: { userId, ...values },
      });
      return toDomainObject(result.insert_minerva_tags_one);
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicate(values.name);
      throw error;
    }
  }

  /**
   * Renames a tag or changes its colour. Answers `undefined` when the body
   * names nothing to change.
   */
  async update(
    userId: string,
    tagId: string,
    changes: PartialTag | undefined,
  ): Promise<Tag | undefined> {
    const set = validatePartial(changes);
    // First, so a missing tag is a 404 before anything is written.
    const current = await this.describe(userId, tagId);
    if (Object.keys(set).length === 0) return undefined;
    if (set.name === current.name) delete set.name;
    if (set.color !== undefined && set.color === (current.color ?? null)) {
      delete set.color;
    }
    if (Object.keys(set).length === 0) return current;

    const document = gql`
      mutation UpdateTag(
        $userId: uuid!
        $tagId: uuid!
        $set: minerva_tags_set_input!
      ) {
        update_minerva_tags(
          where: { id: { _eq: $tagId }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${TAG}
          }
        }
      }
    `;
    type Result = { update_minerva_tags: { returning: GraphQlTag[] } };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        userId,
        tagId,
        set,
      });
      const row = result.update_minerva_tags.returning[0];
      if (!row) throw notFound(tagId);
      return toDomainObject(row);
    } catch (error) {
      if (isUniqueViolation(error) && set.name) throw duplicate(set.name);
      throw error;
    }
  }

  /**
   * Removes one of the user's tags, and with it every use of it: the join
   * tables cascade.
   */
  async delete(userId: string, tagId: string): Promise<void> {
    const document = gql`
      mutation DeleteTag($userId: uuid!, $tagId: uuid!) {
        delete_minerva_tags(
          where: { id: { _eq: $tagId }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_tags: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      tagId,
    });
    if (result.delete_minerva_tags.affected_rows === 0) throw notFound(tagId);
  }
}

const notFound = (tagId: string) =>
  new NotFoundException(`Tag with id ${tagId} not found`);

const duplicate = (name: string) =>
  new ConflictException(`You already have a tag named ${name}`);

const isUniqueViolation = (error: unknown) =>
  error instanceof ClientError &&
  (error.response.errors ?? []).some(
    (e) =>
      (e.extensions as { code?: string } | undefined)?.code ===
      "constraint-violation",
  );

/** `%`, `_` and `\` are LIKE's own characters; a prefix matches them as text. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

/**
 * The global ValidationPipe is off (docs/conventions/model.md), and these
 * values reach the database, so they are checked here.
 */
const checkPrefix = (value: unknown): string | undefined => {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > MAX_NAME) {
    throw new BadRequestException(
      `prefix must be text of at most ${MAX_NAME} characters`,
    );
  }
  return value.trim() || undefined;
};

const validateBase = (
  tag: BaseTag | undefined,
): { name: string; color: string | null } => {
  if (!tag || typeof tag !== "object") {
    throw new BadRequestException("tag is required");
  }
  const problems: string[] = [];
  const name = checkName(tag.name, problems);
  const color = checkColor(tag.color, problems);
  if (problems.length) throw new BadRequestException(problems);
  return { name, color };
};

const validatePartial = (
  changes: PartialTag | undefined,
): { name?: string; color?: string | null } => {
  if (!changes || typeof changes !== "object") {
    throw new BadRequestException("tag is required");
  }
  const problems: string[] = [];
  const set: { name?: string; color?: string | null } = {};
  if (changes.name !== undefined) set.name = checkName(changes.name, problems);
  if (changes.color !== undefined) {
    set.color = checkColor(changes.color, problems);
  }
  if (problems.length) throw new BadRequestException(problems);
  return set;
};

const checkName = (value: unknown, problems: string[]): string => {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > MAX_NAME) {
    problems.push(`name must be 1 to ${MAX_NAME} characters`);
  }
  return name;
};

/** A hex colour, stored lowercase; null or an empty string means none. */
const checkColor = (value: unknown, problems: string[]): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const color = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!COLOR.test(color)) {
    problems.push("color must be a hex colour such as #1677ff");
    return null;
  }
  return color;
};
