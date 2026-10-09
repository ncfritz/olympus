import { BaseReviewPin, ReviewKind, ReviewPin } from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { isUniqueViolation } from "../../utils/hasuraErrors";
import { isUuid } from "../../utils/validation";
import {
  GraphQlReviewPin,
  toDomainObject,
} from "../converters/ReviewPinConverter";
import { REVIEW_PIN } from "../queries/reviews";
import { periodEndOf } from "../utils/periods";

type ReviewRef = { kind: string; periodStart: string };

/**
 * A user's weekly review pins in Hasura (ADR 0027): an answer from one of
 * the week's daily reviews, or a note. Every method takes the caller's user
 * ID and scopes by it, so another user's review or pin is simply not
 * found.
 */
@Injectable()
export class ReviewPinService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** One of the user's reviews' pins, oldest first. */
  async list(userId: string, reviewId: string): Promise<ReviewPin[]> {
    const document = gql`
      query ListReviewPins($userId: uuid!, $reviewId: uuid!) {
        minerva_reviews(
          where: { id: { _eq: $reviewId }, userId: { _eq: $userId } }
        ) {
          id
        }
        minerva_review_pins(
          where: { reviewId: { _eq: $reviewId }, userId: { _eq: $userId } }
          order_by: { createdTime: asc }
        ) {
          ${REVIEW_PIN}
        }
      }
    `;
    type Result = {
      minerva_reviews: { id: string }[];
      minerva_review_pins: GraphQlReviewPin[];
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      reviewId,
    });
    if (result.minerva_reviews.length === 0) throw reviewNotFound(reviewId);
    return result.minerva_review_pins.map(toDomainObject);
  }

  /**
   * Pins an answer from one of the week's daily reviews, or a note, to one
   * of the user's weekly reviews, once each.
   */
  async create(
    userId: string,
    reviewId: string,
    pin: BaseReviewPin | undefined,
  ): Promise<ReviewPin> {
    if (!pin || typeof pin !== "object") {
      throw new BadRequestException("reviewPin is required");
    }
    const answerId = pin.answerId;
    const noteId = pin.noteId;
    if ((answerId === undefined) === (noteId === undefined)) {
      throw new BadRequestException("give exactly one of answerId and noteId");
    }
    const targetId = answerId ?? noteId;
    if (!isUuid(targetId)) {
      throw new BadRequestException(
        `${answerId !== undefined ? "answerId" : "noteId"} must be an ID`,
      );
    }

    const contextDocument = gql`
      query GetReviewPinContext(
        $userId: uuid!
        $reviewId: uuid!
        $targetId: uuid!
        $isAnswer: Boolean!
      ) {
        minerva_reviews(
          where: { id: { _eq: $reviewId }, userId: { _eq: $userId } }
        ) {
          kind
          periodStart
        }
        minerva_review_answers(
          where: { id: { _eq: $targetId }, userId: { _eq: $userId } }
        ) @include(if: $isAnswer) {
          review {
            kind
            periodStart
          }
        }
        minerva_notes(
          where: { id: { _eq: $targetId }, userId: { _eq: $userId } }
        ) @skip(if: $isAnswer) {
          id
        }
      }
    `;
    type ContextResult = {
      minerva_reviews: ReviewRef[];
      minerva_review_answers?: { review: ReviewRef }[];
      minerva_notes?: { id: string }[];
    };
    const context = await this.graphQLClient.request<ContextResult>(
      contextDocument,
      { userId, reviewId, targetId, isAnswer: answerId !== undefined },
    );
    const review = context.minerva_reviews[0];
    if (!review) throw reviewNotFound(reviewId);
    if (review.kind !== ReviewKind.Weekly) {
      throw new BadRequestException("Only a weekly review keeps pins");
    }
    if (answerId !== undefined) {
      const answer = context.minerva_review_answers?.[0];
      if (!answer) {
        throw new NotFoundException(
          `Review answer with id ${answerId} not found`,
        );
      }
      const sunday = periodEndOf(ReviewKind.Weekly, review.periodStart);
      if (
        answer.review.kind !== ReviewKind.Daily ||
        answer.review.periodStart < review.periodStart ||
        answer.review.periodStart > sunday
      ) {
        throw new BadRequestException(
          `Only an answer from a daily review of ${review.periodStart} to ${sunday} is pinned to this week`,
        );
      }
    } else if (!context.minerva_notes?.length) {
      throw new NotFoundException(`Note with id ${noteId} not found`);
    }

    const document = gql`
      mutation CreateReviewPin($object: minerva_review_pins_insert_input!) {
        insert_minerva_review_pins_one(object: $object) {
          ${REVIEW_PIN}
        }
      }
    `;
    type Result = { insert_minerva_review_pins_one: GraphQlReviewPin };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: {
          userId,
          reviewId,
          ...(answerId !== undefined ? { answerId } : { noteId }),
        },
      });
      return toDomainObject(result.insert_minerva_review_pins_one);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("That is already pinned to this week");
      }
      throw error;
    }
  }

  /** Unpins one of a review's pins. */
  async delete(userId: string, reviewId: string, pinId: string): Promise<void> {
    const document = gql`
      mutation DeleteReviewPin(
        $userId: uuid!
        $reviewId: uuid!
        $pinId: uuid!
      ) {
        delete_minerva_review_pins(
          where: {
            id: { _eq: $pinId }
            reviewId: { _eq: $reviewId }
            userId: { _eq: $userId }
          }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_review_pins: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      reviewId,
      pinId,
    });
    if (result.delete_minerva_review_pins.affected_rows === 0) {
      throw new NotFoundException(`Review pin with id ${pinId} not found`);
    }
  }
}

const reviewNotFound = (reviewId: string) =>
  new NotFoundException(`Review with id ${reviewId} not found`);
