import {
  PartialReviewAnswer,
  ReviewAnswer,
  ReviewItem,
  ReviewItemKind,
  ReviewPromptStyle,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { isUniqueViolation } from "../../utils/hasuraErrors";
import { isStringList } from "../../utils/validation";
import {
  GraphQlReviewAnswer,
  toReviewAnswer,
} from "../converters/ReviewConverter";
import { REVIEW_ANSWER } from "../queries/reviews";
import { ReviewItemService } from "./ReviewItemService";

/** The longest text answer, in characters. */
export const MAX_ANSWER = 10000;
/** The longest list item, in characters: a to-do's title. */
export const MAX_ITEM = 200;

/** A review, one of its prompts, and that prompt's answers in the review. */
type AnswerContext = {
  kind: string;
  completedTime: string | null;
  style: ReviewPromptStyle;
  /** In their order. */
  answers: GraphQlReviewAnswer[];
};

/**
 * What a review's author writes for its prompts (ADR 0027): one answer to a
 * text prompt, or a list prompt's items, each an answer of its own in its
 * order, any of which can become a to-do of the period after the review's.
 * Every method takes the caller's user ID and scopes by it, so another
 * user's review, prompt or answer is simply not found.
 */
@Injectable()
export class ReviewAnswerService {
  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly reviewItems: ReviewItemService,
  ) {}

  /**
   * Saves the answer to one of the review's text prompts. A body that is
   * empty or only whitespace removes the answer, and answers `undefined`.
   * An answer saved again keeps its row and created time.
   */
  async save(
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
    const context = await this.context(userId, reviewId, promptId);
    if (context.style === ReviewPromptStyle.List) {
      throw new BadRequestException(
        "The prompt is answered as a list; add items to it instead",
      );
    }
    const existing = context.answers[0];

    if (!body) {
      if (existing) {
        const document = gql`
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
        await this.graphQLClient.request(document, {
          userId,
          reviewId,
          promptId,
        });
      }
      return undefined;
    }

    if (existing) {
      const document = gql`
        mutation UpdateReviewAnswer($userId: uuid!, $answerId: uuid!, $body: String!) {
          update_minerva_review_answers(
            where: { id: { _eq: $answerId }, userId: { _eq: $userId } }
            _set: { body: $body }
          ) {
            returning {
              ${REVIEW_ANSWER}
            }
          }
        }
      `;
      type Result = {
        update_minerva_review_answers: { returning: GraphQlReviewAnswer[] };
      };
      const result = await this.graphQLClient.request<Result>(document, {
        userId,
        answerId: existing.id,
        body,
      });
      const row = result.update_minerva_review_answers.returning[0];
      if (!row) throw reviewNotFound(reviewId);
      return toReviewAnswer(row, context.completedTime);
    }

    return this.insert(userId, reviewId, promptId, context, body, 0);
  }

  /** Adds an item at the end of one of the review's list prompts. */
  async addItem(
    userId: string,
    reviewId: string,
    promptId: string,
    answer: PartialReviewAnswer | undefined,
  ): Promise<ReviewAnswer> {
    const body = checkItem(answer);
    const context = await this.listContext(userId, reviewId, promptId);
    const position =
      Math.max(-1, ...context.answers.map((a) => a.position)) + 1;
    return this.insert(userId, reviewId, promptId, context, body, position);
  }

  /** Rewrites one of a list prompt's items. */
  async updateItem(
    userId: string,
    reviewId: string,
    promptId: string,
    answerId: string,
    answer: PartialReviewAnswer | undefined,
  ): Promise<ReviewAnswer> {
    const body = checkItem(answer);
    const context = await this.listContext(userId, reviewId, promptId);
    itemOf(context, answerId);

    const document = gql`
      mutation UpdateReviewAnswerItem($userId: uuid!, $answerId: uuid!, $body: String!) {
        update_minerva_review_answers(
          where: { id: { _eq: $answerId }, userId: { _eq: $userId } }
          _set: { body: $body }
        ) {
          returning {
            ${REVIEW_ANSWER}
          }
        }
      }
    `;
    type Result = {
      update_minerva_review_answers: { returning: GraphQlReviewAnswer[] };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      answerId,
      body,
    });
    const row = result.update_minerva_review_answers.returning[0];
    if (!row) throw itemNotFound(answerId);
    return toReviewAnswer(row, context.completedTime);
  }

  /**
   * Removes one of a list prompt's items. A to-do it became stays: it is
   * a plan item of its own by then.
   */
  async deleteItem(
    userId: string,
    reviewId: string,
    promptId: string,
    answerId: string,
  ): Promise<void> {
    const context = await this.listContext(userId, reviewId, promptId);
    itemOf(context, answerId);
    const document = gql`
      mutation DeleteReviewAnswerItem($userId: uuid!, $answerId: uuid!) {
        delete_minerva_review_answers(
          where: { id: { _eq: $answerId }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    type Result = { delete_minerva_review_answers: { affected_rows: number } };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      answerId,
    });
    if (result.delete_minerva_review_answers.affected_rows === 0) {
      throw itemNotFound(answerId);
    }
  }

  /** Puts a list prompt's items in the review in the order given. */
  async reorderItems(
    userId: string,
    reviewId: string,
    promptId: string,
    answerIds: unknown,
  ): Promise<ReviewAnswer[]> {
    if (!isStringList(answerIds)) {
      throw new BadRequestException("answerIds must be a list of IDs");
    }
    const context = await this.listContext(userId, reviewId, promptId);
    const given = new Set(answerIds);
    if (
      given.size !== answerIds.length ||
      given.size !== context.answers.length ||
      context.answers.some((a) => !given.has(a.id))
    ) {
      throw new BadRequestException(
        "answerIds must name each of the prompt's items in the review exactly once",
      );
    }

    // The position constraint is deferred, so the rows may collide on the
    // way to their new places and are checked when the mutation commits.
    const document = gql`
      mutation ReorderReviewAnswerItems(
        $updates: [minerva_review_answers_updates!]!
      ) {
        update_minerva_review_answers_many(updates: $updates) {
          returning {
            ${REVIEW_ANSWER}
          }
        }
      }
    `;
    type Result = {
      update_minerva_review_answers_many: {
        returning: GraphQlReviewAnswer[];
      }[];
    };
    const result = await this.graphQLClient.request<Result>(document, {
      updates: answerIds.map((id, position) => ({
        where: { id: { _eq: id }, userId: { _eq: userId } },
        _set: { position },
      })),
    });
    return result.update_minerva_review_answers_many
      .flatMap((update) => update.returning)
      .sort((a, b) => a.position - b.position)
      .map((row) => toReviewAnswer(row, context.completedTime));
  }

  /**
   * Makes a list item a to-do of the period after the review's (tomorrow
   * for a day, next week for a week), last of its to-dos and titled as the
   * item reads, and links the two. An item becomes one to-do, once.
   */
  async toTodo(
    userId: string,
    reviewId: string,
    promptId: string,
    answerId: string,
  ): Promise<{ answer: ReviewAnswer; reviewItem: ReviewItem }> {
    const context = await this.listContext(userId, reviewId, promptId);
    const item = itemOf(context, answerId);
    if (item.reviewItemId) {
      throw new ConflictException("The item is already a to-do");
    }

    const reviewItem = await this.reviewItems.create(userId, reviewId, {
      kind: ReviewItemKind.Todo,
      title: item.body,
    });

    // Linked only while unlinked, so two at once make one to-do: the
    // second's is taken away again.
    const document = gql`
      mutation LinkReviewAnswerTodo(
        $userId: uuid!
        $answerId: uuid!
        $reviewItemId: uuid!
      ) {
        update_minerva_review_answers(
          where: {
            id: { _eq: $answerId }
            userId: { _eq: $userId }
            reviewItemId: { _is_null: true }
          }
          _set: { reviewItemId: $reviewItemId }
        ) {
          returning {
            ${REVIEW_ANSWER}
          }
        }
      }
    `;
    type Result = {
      update_minerva_review_answers: { returning: GraphQlReviewAnswer[] };
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      answerId,
      reviewItemId: reviewItem.id,
    });
    const row = result.update_minerva_review_answers.returning[0];
    if (!row) {
      await this.reviewItems.delete(userId, reviewItem.id);
      throw new ConflictException("The item is already a to-do");
    }
    return {
      answer: toReviewAnswer(row, context.completedTime),
      reviewItem,
    };
  }

  /**
   * The review, the prompt and the prompt's answers in the review; the
   * prompt must be the caller's and of the review's kind.
   */
  private async context(
    userId: string,
    reviewId: string,
    promptId: string,
  ): Promise<AnswerContext> {
    const document = gql`
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
          answers(
            where: { promptId: { _eq: $promptId } }
            order_by: { position: asc }
          ) {
            ${REVIEW_ANSWER}
          }
        }
        minerva_review_prompts(
          where: { id: { _eq: $promptId }, userId: { _eq: $userId } }
        ) {
          kind
          style
        }
      }
    `;
    type Result = {
      minerva_reviews: {
        kind: string;
        completedTime: string | null;
        answers?: GraphQlReviewAnswer[];
      }[];
      minerva_review_prompts: { kind: string; style?: string }[];
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      reviewId,
      promptId,
    });
    const review = result.minerva_reviews[0];
    const prompt = result.minerva_review_prompts[0];
    if (!review) throw reviewNotFound(reviewId);
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
    return {
      kind: review.kind,
      completedTime: review.completedTime,
      style: (prompt.style as ReviewPromptStyle) ?? ReviewPromptStyle.Text,
      answers: review.answers ?? [],
    };
  }

  /** The context of a list prompt; a text prompt has no items. */
  private async listContext(
    userId: string,
    reviewId: string,
    promptId: string,
  ): Promise<AnswerContext> {
    const context = await this.context(userId, reviewId, promptId);
    if (context.style !== ReviewPromptStyle.List) {
      throw new BadRequestException(
        "The prompt is answered as text, not as a list of items",
      );
    }
    return context;
  }

  private async insert(
    userId: string,
    reviewId: string,
    promptId: string,
    context: AnswerContext,
    body: string,
    position: number,
  ): Promise<ReviewAnswer> {
    const document = gql`
      mutation CreateReviewAnswer($object: minerva_review_answers_insert_input!) {
        insert_minerva_review_answers_one(object: $object) {
          ${REVIEW_ANSWER}
        }
      }
    `;
    type Result = { insert_minerva_review_answers_one: GraphQlReviewAnswer };
    try {
      const result = await this.graphQLClient.request<Result>(document, {
        object: {
          reviewId,
          promptId,
          userId,
          kind: context.kind,
          body,
          position,
        },
      });
      return toReviewAnswer(
        result.insert_minerva_review_answers_one,
        context.completedTime,
      );
    } catch (error) {
      // Two saved at once: the second takes the same place and is refused
      // rather than racing ahead.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          "Another answer was saved to that prompt at the same time; try again",
        );
      }
      throw error;
    }
  }
}

const reviewNotFound = (reviewId: string) =>
  new NotFoundException(`Review with id ${reviewId} not found`);

const itemNotFound = (answerId: string) =>
  new NotFoundException(`Review answer item with id ${answerId} not found`);

/** The item among the prompt's answers in the review, or a 404. */
const itemOf = (
  context: AnswerContext,
  answerId: string,
): GraphQlReviewAnswer => {
  const item = context.answers.find((a) => a.id === answerId);
  if (!item) throw itemNotFound(answerId);
  return item;
};

/** A list item's body: something besides whitespace, at most 200 characters. */
const checkItem = (answer: PartialReviewAnswer | undefined): string => {
  if (!answer || typeof answer !== "object") {
    throw new BadRequestException("answer is required");
  }
  const body = typeof answer.body === "string" ? answer.body.trim() : "";
  if (!body || body.length > MAX_ITEM) {
    throw new BadRequestException(`body must be 1 to ${MAX_ITEM} characters`);
  }
  return body;
};
