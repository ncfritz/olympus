import {
  BaseReview,
  PartialReview,
  PartialReviewAnswer,
  Review,
  ReviewAnswer,
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
import {
  checkTimezone,
  daysBetween,
  isIsoDate,
  todayIn,
} from "../../utils/localDates";
import { checkEnum, checkInteger } from "../../utils/validation";
import {
  GraphQlReview,
  GraphQlReviewAnswer,
  toDomainObject,
  toReviewAnswer,
} from "../converters/ReviewConverter";
import { REVIEW, REVIEW_ANSWER } from "../queries/reviews";
import {
  ALL_RATINGS,
  currentPeriodStart,
  periodStartOf,
  type RatingName,
  STEPS,
  takesRating,
} from "../utils/periods";

const MAX_ANSWER = 10000;
/** The longest range ListReviews answers, in days: a little over a year. */
const MAX_RANGE_DAYS = 400;

type ReviewChanges = { step?: number } & Partial<
  Record<RatingName, number | null>
>;

/**
 * A user's daily and weekly reviews and their answers in Hasura (ADR 0027).
 * Every method takes the caller's user ID and scopes by it, so another
 * user's review is simply not found.
 */
@Injectable()
export class ReviewService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** The user's reviews of one kind whose periods start from `from` to `to`. */
  async list(
    userId: string,
    kind: unknown,
    from: unknown,
    to: unknown,
  ): Promise<Review[]> {
    const problems: string[] = [];
    checkEnum(kind, ReviewKind, "kind", problems);
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
      query ListReviews(
        $userId: uuid!
        $kind: String!
        $from: date!
        $to: date!
      ) {
        minerva_reviews(
          where: {
            userId: { _eq: $userId }
            kind: { _eq: $kind }
            periodStart: { _gte: $from, _lte: $to }
          }
          order_by: { periodStart: asc }
        ) {
          ${REVIEW}
        }
      }
    `;
    type Result = { minerva_reviews: GraphQlReview[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      kind,
      from,
      to,
    });
    return result.minerva_reviews.map(toDomainObject);
  }

  /** One of the user's reviews, with its answers. */
  async describe(userId: string, reviewId: string): Promise<Review> {
    const document = gql`
      query DescribeReview($userId: uuid!, $reviewId: uuid!) {
        minerva_reviews(
          where: { id: { _eq: $reviewId }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${REVIEW}
        }
      }
    `;
    type Result = { minerva_reviews: GraphQlReview[] };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      reviewId,
    });
    const row = result.minerva_reviews[0];
    if (!row) throw notFound(reviewId);
    return toDomainObject(row);
  }

  /**
   * Starts a review of a day or a week. A period after the current one,
   * where the caller is, is refused: it has not happened yet.
   */
  async create(
    userId: string,
    review: BaseReview | undefined,
    tz: string,
  ): Promise<Review> {
    if (!review || typeof review !== "object") {
      throw new BadRequestException("review is required");
    }
    const problems: string[] = [];
    const kind = checkEnum(review.kind, ReviewKind, "kind", problems);
    if (problems.length) throw new BadRequestException(problems);
    const periodStart = periodStartOf(kind, review.period);
    if (!periodStart) {
      throw new BadRequestException(
        kind === ReviewKind.Daily
          ? "period must be a date as YYYY-MM-DD"
          : "period must be an ISO week as YYYY-Www, such as 2026-W40, or its Monday as YYYY-MM-DD",
      );
    }
    const current = currentPeriodStart(kind, todayIn(checkTimezone(tz)));
    if (periodStart > current) {
      throw new BadRequestException(
        kind === ReviewKind.Daily
          ? `period must not be after today, ${current}`
          : `period must not be after this week, which starts ${current}`,
      );
    }

    const document = gql`
      mutation CreateReview($object: minerva_reviews_insert_input!) {
        insert_minerva_reviews_one(object: $object) {
          ${REVIEW}
        }
      }
    `;
    type Result = { insert_minerva_reviews_one: GraphQlReview };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: { userId, kind, periodStart },
      });
      return toDomainObject(result.insert_minerva_reviews_one);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `You already have a ${kind} review of ${periodStart}`,
        );
      }
      throw error;
    }
  }

  /**
   * Sets the step reached and the ratings. A rating is refused once the
   * review is completed, and on the kind that does not take it. Answers
   * `undefined` when the body names nothing to change.
   */
  async update(
    userId: string,
    reviewId: string,
    changes: PartialReview | undefined,
  ): Promise<Review | undefined> {
    const changed = validatePartial(changes);
    const current = await this.describe(userId, reviewId);
    if (Object.keys(changed).length === 0) return undefined;

    const problems: string[] = [];
    if (changed.step !== undefined && changed.step > STEPS[current.kind]) {
      problems.push(
        `step must be a whole number from 1 to ${STEPS[current.kind]} on a ${current.kind} review`,
      );
    }
    for (const rating of ALL_RATINGS) {
      if (changed[rating] !== undefined && !takesRating(current.kind, rating)) {
        problems.push(`a ${current.kind} review has no ${rating} rating`);
      }
    }
    if (problems.length) throw new BadRequestException(problems);

    const set: ReviewChanges = {};
    if (changed.step !== undefined && changed.step !== current.step) {
      set.step = changed.step;
    }
    for (const rating of ALL_RATINGS) {
      const value = changed[rating];
      if (value !== undefined && value !== (current[rating] ?? null)) {
        set[rating] = value;
      }
    }
    if (
      current.completed &&
      ALL_RATINGS.some((rating) => set[rating] !== undefined)
    ) {
      throw new ConflictException(
        "The review is completed; its ratings no longer change",
      );
    }
    if (Object.keys(set).length === 0) return current;

    const document = gql`
      mutation UpdateReview(
        $userId: uuid!
        $reviewId: uuid!
        $set: minerva_reviews_set_input!
      ) {
        update_minerva_reviews(
          where: { id: { _eq: $reviewId }, userId: { _eq: $userId } }
          _set: $set
        ) {
          returning {
            ${REVIEW}
          }
        }
      }
    `;
    type Result = { update_minerva_reviews: { returning: GraphQlReview[] } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      reviewId,
      set,
    });
    const row = result.update_minerva_reviews.returning[0];
    if (!row) throw notFound(reviewId);
    return toDomainObject(row);
  }

  /**
   * Completes a review, which locks its ratings. Answers `undefined` when it
   * was already complete.
   */
  async complete(
    userId: string,
    reviewId: string,
  ): Promise<Review | undefined> {
    const document = gql`
      mutation CompleteReview(
        $userId: uuid!
        $reviewId: uuid!
        $now: timestamptz!
      ) {
        update_minerva_reviews(
          where: {
            id: { _eq: $reviewId }
            userId: { _eq: $userId }
            completedTime: { _is_null: true }
          }
          _set: { completedTime: $now }
        ) {
          returning {
            ${REVIEW}
          }
        }
      }
    `;
    type Result = { update_minerva_reviews: { returning: GraphQlReview[] } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      reviewId,
      now: new Date().toISOString(),
    });
    const row = result.update_minerva_reviews.returning[0];
    if (row) return toDomainObject(row);
    // Nothing changed: either it is not the caller's, or it was complete.
    await this.describe(userId, reviewId);
    return undefined;
  }

  /** Removes one of the user's reviews, and its answers with it. */
  async delete(userId: string, reviewId: string): Promise<void> {
    const document = gql`
      mutation DeleteReview($userId: uuid!, $reviewId: uuid!) {
        delete_minerva_reviews(
          where: { id: { _eq: $reviewId }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_reviews: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      reviewId,
    });
    if (result.delete_minerva_reviews.affected_rows === 0) {
      throw notFound(reviewId);
    }
  }

  /**
   * Saves the answer to one of the review's prompts, which must be the
   * caller's and of the review's kind. A body that is empty or only
   * whitespace removes the answer, and answers `undefined`.
   */
  async answer(
    userId: string,
    reviewId: string,
    promptId: string,
    answer: PartialReviewAnswer | undefined,
  ): Promise<ReviewAnswer | undefined> {
    if (!answer || typeof answer !== "object") {
      throw new BadRequestException("answer is required");
    }
    if (typeof answer.body !== "string" || answer.body.length > MAX_ANSWER) {
      throw new BadRequestException(
        `body must be text of at most ${MAX_ANSWER} characters`,
      );
    }
    const body = answer.body.trim();

    const contextDocument = gql`
      query GetReviewAnswerContext(
        $userId: uuid!
        $reviewId: uuid!
        $promptId: uuid!
      ) {
        minerva_reviews(
          where: { id: { _eq: $reviewId }, userId: { _eq: $userId } }
        ) {
          kind
          completedTime
        }
        minerva_review_prompts(
          where: { id: { _eq: $promptId }, userId: { _eq: $userId } }
        ) {
          kind
        }
      }
    `;
    type ContextResult = {
      minerva_reviews: { kind: string; completedTime: string | null }[];
      minerva_review_prompts: { kind: string }[];
    };
    const context = await this.graphQLClient.request<ContextResult>(
      contextDocument,
      { userId, reviewId, promptId },
    );
    const review = context.minerva_reviews[0];
    const prompt = context.minerva_review_prompts[0];
    if (!review) throw notFound(reviewId);
    if (!prompt) {
      throw new NotFoundException(
        `Review prompt with id ${promptId} not found`,
      );
    }
    if (prompt.kind !== review.kind) {
      throw new BadRequestException(
        `The prompt is asked in ${prompt.kind} reviews, not ${review.kind} ones`,
      );
    }

    if (!body) {
      const removeDocument = gql`
        mutation RemoveReviewAnswer(
          $userId: uuid!
          $reviewId: uuid!
          $promptId: uuid!
        ) {
          delete_minerva_review_answers(
            where: {
              reviewId: { _eq: $reviewId }
              promptId: { _eq: $promptId }
              userId: { _eq: $userId }
            }
          ) {
            affected_rows
          }
        }
      `;
      await this.graphQLClient.request(removeDocument, {
        userId,
        reviewId,
        promptId,
      });
      return undefined;
    }

    // An upsert, so an answer saved again keeps its row and created time.
    const document = gql`
      mutation UpdateReviewAnswer(
        $object: minerva_review_answers_insert_input!
      ) {
        insert_minerva_review_answers_one(
          object: $object
          on_conflict: {
            constraint: review_answers_review_id_prompt_id_key
            update_columns: [body]
          }
        ) {
          ${REVIEW_ANSWER}
        }
      }
    `;
    type Result = { insert_minerva_review_answers_one: GraphQlReviewAnswer };
    const result = await this.graphQLClient.request<Result>(document, {
      object: { reviewId, promptId, userId, kind: review.kind, body },
    });
    return toReviewAnswer(
      result.insert_minerva_review_answers_one,
      review.completedTime,
    );
  }
}

const notFound = (reviewId: string) =>
  new NotFoundException(`Review with id ${reviewId} not found`);

/** A rating: a whole number from 1 to 5, or null to clear it. */
const checkRating = (
  value: unknown,
  name: string,
  problems: string[],
): number | null =>
  value === null ? null : checkInteger(value, name, 1, 5, problems);

const validatePartial = (changes: PartialReview | undefined): ReviewChanges => {
  if (!changes || typeof changes !== "object") {
    throw new BadRequestException("review is required");
  }
  const problems: string[] = [];
  const changed: ReviewChanges = {};
  if (changes.step !== undefined) {
    changed.step = checkInteger(changes.step, "step", 1, 5, problems);
  }
  for (const rating of ALL_RATINGS) {
    const value = (changes as Record<string, unknown>)[rating];
    if (value !== undefined) {
      changed[rating] = checkRating(value, rating, problems);
    }
  }
  if (problems.length) throw new BadRequestException(problems);
  return changed;
};
