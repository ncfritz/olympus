import {
  BaseReviewItem,
  PartialReviewItem,
  ReviewItem,
  ReviewItemKind,
  ReviewItemScope,
  ReviewItemStatus,
  ReviewKind,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { isUniqueViolation } from "../../utils/hasuraErrors";
import { daysBetween, isIsoDate, isMonday } from "../../utils/localDates";
import { checkEnum, isStringList, isUuid } from "../../utils/validation";
import {
  GraphQlReviewItem,
  toDomainObject,
} from "../converters/ReviewItemConverter";
import { REVIEW_ITEM } from "../queries/reviews";
import { itemPeriodEndOf, nextPeriodStart, SCOPE_OF } from "../utils/periods";

const MAX_TITLE = 200;
/** The longest range ListReviewItems answers, in days: a little over a year. */
const MAX_RANGE_DAYS = 400;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The statuses an update may set; carrying has its own operation. */
const SETTABLE: readonly ReviewItemStatus[] = [
  ReviewItemStatus.Open,
  ReviewItemStatus.Done,
  ReviewItemStatus.Someday,
  ReviewItemStatus.Dropped,
];

/** The statuses an item can be carried from. */
const CARRIABLE: readonly ReviewItemStatus[] = [
  ReviewItemStatus.Open,
  ReviewItemStatus.Someday,
];

type ItemChanges = {
  title?: string;
  status?: ReviewItemStatus;
  scheduledOn?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
};

type ItemSet = Omit<ItemChanges, "status"> & {
  status?: ReviewItemStatus;
  doneTime?: string | null;
};

type ReviewRef = { kind: string; periodStart: string };

/**
 * A user's plan items in Hasura (ADR 0027): the priorities and to-dos their
 * reviews plan for the next day or week. Every method takes the caller's
 * user ID and scopes by it, so another user's item is simply not found.
 */
@Injectable()
export class ReviewItemService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * The user's items of one scope whose periods start from `from` to `to`,
   * every status: by period, priorities before to-dos, each in its order.
   */
  async list(
    userId: string,
    scope: unknown,
    from: unknown,
    to: unknown,
  ): Promise<ReviewItem[]> {
    const problems: string[] = [];
    checkEnum(scope, ReviewItemScope, "scope", problems);
    if (!isIsoDate(from)) problems.push("from must be a date as YYYY-MM-DD");
    if (!isIsoDate(to)) problems.push("to must be a date as YYYY-MM-DD");
    if (isIsoDate(from) && isIsoDate(to)) {
      const days = daysBetween(from, to);
      if (days < 0) problems.push("to must not be before from");
      if (days > MAX_RANGE_DAYS) {
        problems.push(
          `from and to may be at most ${MAX_RANGE_DAYS} days apart`,
        );
      }
    }
    if (problems.length) throw new BadRequestException(problems);

    const document = gql`
      query ListReviewItems(
        $userId: uuid!
        $scope: String!
        $from: date!
        $to: date!
      ) {
        minerva_review_items(
          where: {
            userId: { _eq: $userId }
            scope: { _eq: $scope }
            periodStart: { _gte: $from, _lte: $to }
          }
          order_by: [{ periodStart: asc }, { kind: asc }, { position: asc }]
        ) {
          ${REVIEW_ITEM}
        }
      }
    `;
    type Result = { minerva_review_items: GraphQlReviewItem[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      scope,
      from,
      to,
    });
    return result.minerva_review_items.map(toDomainObject);
  }

  /** One of the user's items. */
  async describe(userId: string, itemId: string): Promise<ReviewItem> {
    const document = gql`
      query DescribeReviewItem($userId: uuid!, $itemId: uuid!) {
        minerva_review_items(
          where: { id: { _eq: $itemId }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${REVIEW_ITEM}
        }
      }
    `;
    type Result = { minerva_review_items: GraphQlReviewItem[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      itemId,
    });
    const row = result.minerva_review_items[0];
    if (!row) throw notFound(itemId);
    return toDomainObject(row);
  }

  /**
   * Plans an item in one of the user's reviews, for the period after it
   * (a daily review plans tomorrow, a weekly one next week), at the end of
   * its kind.
   */
  async create(
    userId: string,
    reviewId: string,
    item: BaseReviewItem | undefined,
  ): Promise<ReviewItem> {
    if (!item || typeof item !== "object") {
      throw new BadRequestException("reviewItem is required");
    }
    const problems: string[] = [];
    const kind = checkEnum(item.kind, ReviewItemKind, "kind", problems);
    const title = checkTitle(item.title, problems);
    if (problems.length) throw new BadRequestException(problems);

    const review = await this.review(userId, reviewId);
    const reviewKind = review.kind as ReviewKind;
    const scope = SCOPE_OF[reviewKind];
    const periodStart = nextPeriodStart(reviewKind, review.periodStart, scope);
    const position = await this.nextPosition(userId, scope, periodStart, kind);

    const document = gql`
      mutation CreateReviewItem($object: minerva_review_items_insert_input!) {
        insert_minerva_review_items_one(object: $object) {
          ${REVIEW_ITEM}
        }
      }
    `;
    type Result = { insert_minerva_review_items_one: GraphQlReviewItem };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: {
          userId,
          reviewId,
          scope,
          periodStart,
          kind,
          title,
          position,
        },
      });
      return toDomainObject(result.insert_minerva_review_items_one);
    } catch (error) {
      if (isUniqueViolation(error)) throw raced();
      throw error;
    }
  }

  /**
   * Changes an item: its title, its status (done records when), or its
   * schedule. A carried item's status no longer changes: its copy carries
   * on. Answers `undefined` when the body names nothing to change.
   */
  async update(
    userId: string,
    itemId: string,
    changes: PartialReviewItem | undefined,
  ): Promise<ReviewItem | undefined> {
    const changed = validatePartial(changes);
    const current = await this.describe(userId, itemId);
    if (Object.keys(changed).length === 0) return undefined;

    const set: ItemSet = {};
    if (changed.title !== undefined && changed.title !== current.title) {
      set.title = changed.title;
    }
    if (changed.status !== undefined && changed.status !== current.status) {
      if (current.status === ReviewItemStatus.Carried) {
        throw new ConflictException(
          "The item was carried; change its copy instead",
        );
      }
      set.status = changed.status;
      set.doneTime =
        changed.status === ReviewItemStatus.Done
          ? new Date().toISOString()
          : null;
    }

    // The schedule as it will stand, checked whole. Clearing the day
    // clears the block on it.
    const clearingDay = changed.scheduledOn === null;
    const on =
      changed.scheduledOn !== undefined
        ? changed.scheduledOn
        : (current.scheduledOn ?? null);
    const start = clearingDay
      ? null
      : changed.scheduledStart !== undefined
        ? changed.scheduledStart
        : (current.scheduledStart ?? null);
    const end = clearingDay
      ? null
      : changed.scheduledEnd !== undefined
        ? changed.scheduledEnd
        : (current.scheduledEnd ?? null);
    const problems = checkSchedule(current, on, start, end);
    if (problems.length) throw new BadRequestException(problems);
    if (on !== (current.scheduledOn ?? null)) set.scheduledOn = on;
    if (start !== (current.scheduledStart ?? null)) set.scheduledStart = start;
    if (end !== (current.scheduledEnd ?? null)) set.scheduledEnd = end;

    if (Object.keys(set).length === 0) return current;

    const document = gql`
      mutation UpdateReviewItem(
        $userId: uuid!
        $itemId: uuid!
        $set: minerva_review_items_set_input!
      ) {
        update_minerva_review_items(
          where: { id: { _eq: $itemId }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${REVIEW_ITEM}
          }
        }
      }
    `;
    type Result = {
      update_minerva_review_items: { returning: GraphQlReviewItem[] };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      itemId,
      set,
    });
    const row = result.update_minerva_review_items.returning[0];
    if (!row) throw notFound(itemId);
    return toDomainObject(row);
  }

  /**
   * Puts one period's items of one kind in the order given, which must name
   * every one of them, whatever their status, exactly once.
   */
  async reorder(
    userId: string,
    scope: unknown,
    periodStart: unknown,
    kind: unknown,
    itemIds: unknown,
  ): Promise<ReviewItem[]> {
    const problems: string[] = [];
    checkEnum(scope, ReviewItemScope, "scope", problems);
    checkEnum(kind, ReviewItemKind, "kind", problems);
    if (!isIsoDate(periodStart)) {
      problems.push("periodStart must be a date as YYYY-MM-DD");
    } else if (scope === ReviewItemScope.Week && !isMonday(periodStart)) {
      problems.push("periodStart must be a Monday for a week's items");
    }
    if (!isStringList(itemIds)) problems.push("itemIds must be a list of IDs");
    if (problems.length) throw new BadRequestException(problems);
    const ids = itemIds as string[];

    const inPeriod = () =>
      this.list(userId, scope, periodStart, periodStart).then((items) =>
        items.filter((item) => item.kind === kind),
      );
    const current = await inPeriod();
    const given = new Set(ids);
    if (
      given.size !== ids.length ||
      given.size !== current.length ||
      current.some((item) => !given.has(item.id))
    ) {
      throw new BadRequestException(
        `itemIds must name each of your ${String(kind)} items of ${String(periodStart)} exactly once`,
      );
    }

    // The position constraint is deferred, so the rows may collide on the
    // way to their new places and are checked when the mutation commits.
    const document = gql`
      mutation ReorderReviewItems($updates: [minerva_review_items_updates!]!) {
        update_minerva_review_items_many(updates: $updates) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(document, {
      updates: ids.map((id, position) => ({
        where: { id: { _eq: id }, userId: { _eq: userId } },
        _set: { position },
      })),
    });
    return inPeriod();
  }

  /**
   * Carries an open or someday item on: marks it carried and makes its copy,
   * open, for the period after the carrying review (in the item's scope, or
   * the one asked for), counting one more carry. An item is carried once.
   */
  async carry(
    userId: string,
    itemId: string,
    reviewId: unknown,
    scope: unknown,
  ): Promise<ReviewItem> {
    const problems: string[] = [];
    if (!isUuid(reviewId)) problems.push("reviewId must be the ID of a review");
    if (scope !== undefined) {
      checkEnum(scope, ReviewItemScope, "scope", problems);
    }
    if (problems.length) throw new BadRequestException(problems);

    const item = await this.describe(userId, itemId);
    const review = await this.review(userId, reviewId as string);
    if (!CARRIABLE.includes(item.status)) {
      throw new ConflictException(
        `The item is ${item.status}; only an open or someday item is carried`,
      );
    }
    const target = (scope as ReviewItemScope | undefined) ?? item.scope;
    const periodStart = nextPeriodStart(
      review.kind as ReviewKind,
      review.periodStart,
      target,
    );
    if (periodStart <= item.periodStart) {
      throw new BadRequestException(
        `Carried from that review the item would be for ${periodStart}, which is not after its own period`,
      );
    }
    const position = await this.nextPosition(
      userId,
      target,
      periodStart,
      item.kind,
    );

    // One transaction: the item is marked carried only while it still is
    // open or someday, and the unique copy per item refuses a second carry.
    const document = gql`
      mutation CarryReviewItem(
        $userId: uuid!
        $itemId: uuid!
        $from: [String!]!
        $copy: minerva_review_items_insert_input!
      ) {
        update_minerva_review_items(
          where: {
            id: { _eq: $itemId }
            userId: { _eq: $userId }
            status: { _in: $from }
          }
          _set: { status: "carried" }
        ) {
          affected_rows
        }
        insert_minerva_review_items_one(object: $copy) {
          ${REVIEW_ITEM}
        }
      }
    `;
    type Result = {
      update_minerva_review_items: { affected_rows: number };
      insert_minerva_review_items_one: GraphQlReviewItem;
    };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        userId,
        itemId,
        from: CARRIABLE,
        copy: {
          userId,
          reviewId,
          scope: target,
          periodStart,
          kind: item.kind,
          title: item.title,
          position,
          carriedFromId: itemId,
          carryCount: item.carryCount + 1,
        },
      });
      return toDomainObject(result.insert_minerva_review_items_one);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "The item was carried, or another item took its place, at the same time",
        );
      }
      throw error;
    }
  }

  /**
   * Removes one of the user's items. Removing a carried copy undoes the
   * carry: the item it came from is open again.
   */
  async delete(userId: string, itemId: string): Promise<void> {
    const item = await this.describe(userId, itemId);
    const document = gql`
      mutation DeleteReviewItem(
        $userId: uuid!
        $itemId: uuid!
        $fromId: uuid!
        $reopen: Boolean!
      ) {
        delete_minerva_review_items(
          where: { id: { _eq: $itemId }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
        update_minerva_review_items(
          where: {
            id: { _eq: $fromId }
            userId: { _eq: $userId }
            status: { _eq: "carried" }
          }
          _set: { status: "open" }
        ) @include(if: $reopen) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_review_items: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      itemId,
      // An ID that cannot be another item, when there is nothing to reopen.
      fromId: item.carriedFromId ?? itemId,
      reopen: item.carriedFromId !== undefined,
    });
    if (result.delete_minerva_review_items.affected_rows === 0) {
      throw notFound(itemId);
    }
  }

  /** The kind and period of one of the user's reviews. */
  private async review(userId: string, reviewId: string): Promise<ReviewRef> {
    const document = gql`
      query GetReviewItemReview($userId: uuid!, $reviewId: uuid!) {
        minerva_reviews(
          where: { id: { _eq: $reviewId }, userId: { _eq: $userId } }
        ) {
          kind
          periodStart
        }
      }
    `;
    type Result = { minerva_reviews: ReviewRef[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      reviewId,
    });
    const review = result.minerva_reviews[0];
    if (!review) {
      throw new NotFoundException(`Review with id ${reviewId} not found`);
    }
    return review;
  }

  /** The position after the last of a period's items of a kind. */
  private async nextPosition(
    userId: string,
    scope: ReviewItemScope,
    periodStart: string,
    kind: ReviewItemKind,
  ): Promise<number> {
    const document = gql`
      query GetReviewItemLastPosition(
        $userId: uuid!
        $scope: String!
        $periodStart: date!
        $kind: String!
      ) {
        minerva_review_items_aggregate(
          where: {
            userId: { _eq: $userId }
            scope: { _eq: $scope }
            periodStart: { _eq: $periodStart }
            kind: { _eq: $kind }
          }
        ) {
          aggregate {
            max {
              position
            }
          }
        }
      }
    `;
    type Result = {
      minerva_review_items_aggregate: {
        aggregate: { max: { position: number | null } };
      };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      scope,
      periodStart,
      kind,
    });
    const last = result.minerva_review_items_aggregate.aggregate.max.position;
    return last === null ? 0 : last + 1;
  }
}

const notFound = (itemId: string) =>
  new NotFoundException(`Review item with id ${itemId} not found`);

const raced = () =>
  new ConflictException(
    "Another item was added there at the same time; try again",
  );

const checkTitle = (value: unknown, problems: string[]): string => {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    problems.push(`title must be 1 to ${MAX_TITLE} characters`);
  }
  return title;
};

/** A schedule as it will stand, against the item's period. */
const checkSchedule = (
  item: ReviewItem,
  on: string | null,
  start: string | null,
  end: string | null,
): string[] => {
  const problems: string[] = [];
  if (on !== null) {
    const last = itemPeriodEndOf(item.scope, item.periodStart);
    if (on < item.periodStart || on > last) {
      problems.push(
        item.scope === ReviewItemScope.Day
          ? `scheduledOn must be the item's day, ${item.periodStart}`
          : `scheduledOn must be a day of the item's week, ${item.periodStart} to ${last}`,
      );
    }
  }
  if ((start === null) !== (end === null)) {
    problems.push("scheduledStart and scheduledEnd come together");
  } else if (start !== null && end !== null) {
    if (start >= end)
      problems.push("scheduledEnd must be after scheduledStart");
    if (on === null) problems.push("a block of time needs scheduledOn");
  }
  return problems;
};

const checkClock = (
  value: unknown,
  name: string,
  problems: string[],
): string | null => {
  if (value === null) return null;
  if (typeof value !== "string" || !CLOCK.test(value)) {
    problems.push(`${name} must be a time as HH:mm, or null`);
    return null;
  }
  return value;
};

const validatePartial = (
  changes: PartialReviewItem | undefined,
): ItemChanges => {
  if (!changes || typeof changes !== "object") {
    throw new BadRequestException("reviewItem is required");
  }
  const problems: string[] = [];
  const changed: ItemChanges = {};
  if (changes.title !== undefined) {
    changed.title = checkTitle(changes.title, problems);
  }
  if (changes.status !== undefined) {
    if (!SETTABLE.includes(changes.status)) {
      problems.push(
        `status must be one of ${SETTABLE.join(", ")}; carry an item with CarryReviewItem`,
      );
    } else {
      changed.status = changes.status;
    }
  }
  const raw = changes as Record<string, unknown>;
  if (raw.scheduledOn !== undefined) {
    if (raw.scheduledOn !== null && !isIsoDate(raw.scheduledOn)) {
      problems.push("scheduledOn must be a date as YYYY-MM-DD, or null");
    } else {
      changed.scheduledOn = raw.scheduledOn as string | null;
    }
  }
  if (raw.scheduledStart !== undefined) {
    changed.scheduledStart = checkClock(
      raw.scheduledStart,
      "scheduledStart",
      problems,
    );
  }
  if (raw.scheduledEnd !== undefined) {
    changed.scheduledEnd = checkClock(
      raw.scheduledEnd,
      "scheduledEnd",
      problems,
    );
  }
  if (problems.length) throw new BadRequestException(problems);
  return changed;
};
