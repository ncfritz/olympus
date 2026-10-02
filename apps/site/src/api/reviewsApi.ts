import {
  carryReviewItem,
  client,
  completeReview,
  createReview,
  createReviewItem,
  deleteReviewItem,
  getReviewSummary,
  listReviewItems,
  listReviewPrompts,
  listReviews,
  type PartialReview,
  type PartialReviewItem,
  reorderReviewItems,
  type Review,
  type ReviewAnswer,
  type ReviewItem,
  type ReviewItemKind,
  type ReviewItemScope,
  type ReviewKind,
  type ReviewPrompt,
  type ReviewSummary,
  updateReview,
  updateReviewAnswer,
  updateReviewItem,
} from "@ncfritz/olympus-sdk/minerva";

/**
 * The daily and weekly reviews through the API (ADR 0027). Every call is
 * the signed-in user's, and every one that depends on today sends the
 * browser's timezone, so "today" and "this week" are the user's own.
 */
class ReviewsApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  private get tz() {
    return {
      headers: {
        "x-ncfritz-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  /* Reviews -------------------------------------------------------------- */

  /** The reviews of a kind whose periods start from `from` to `to`. */
  async listReviews(
    kind: ReviewKind,
    from: string,
    to: string,
  ): Promise<Review[]> {
    const { data } = await listReviews({ query: { kind, from, to } });
    return data.reviews;
  }

  /** Starts a review of a day (YYYY-MM-DD) or a week (YYYY-Www). */
  async createReview(kind: ReviewKind, period: string): Promise<Review> {
    const { data } = await createReview({
      body: { review: { kind, period } },
      ...this.tz,
    });
    return data.review;
  }

  /** The review with the changes, or undefined when nothing changed. */
  async updateReview(
    reviewId: string,
    review: PartialReview,
  ): Promise<Review | undefined> {
    const response = await updateReview({
      path: { reviewId },
      body: { review },
      validateStatus: (status) => status === 200 || status === 304,
    });
    return response.status === 304 ? undefined : response.data.review;
  }

  /** Completes a review; undefined when it already was. */
  async completeReview(reviewId: string): Promise<Review | undefined> {
    const response = await completeReview({
      path: { reviewId },
      validateStatus: (status) => status === 200 || status === 304,
    });
    return response.status === 304 ? undefined : response.data.review;
  }

  /** Saves an answer; an empty body removes it and answers undefined. */
  async saveAnswer(
    reviewId: string,
    promptId: string,
    body: string,
  ): Promise<ReviewAnswer | undefined> {
    const response = await updateReviewAnswer({
      path: { reviewId, promptId },
      body: { answer: { body } },
      validateStatus: (status) => status === 200 || status === 204,
    });
    return response.status === 204 || !response.data
      ? undefined
      : response.data.answer;
  }

  /* Prompts -------------------------------------------------------------- */

  /** The prompts of a kind, archived ones included, in their order. */
  async listPrompts(kind: ReviewKind): Promise<ReviewPrompt[]> {
    const { data } = await listReviewPrompts({ query: { kind } });
    return data.reviewPrompts;
  }

  /* Plan items ----------------------------------------------------------- */

  /** Every item of a scope whose period starts from `from` to `to`. */
  async listItems(
    scope: ReviewItemScope,
    from: string,
    to: string,
  ): Promise<ReviewItem[]> {
    const { data } = await listReviewItems({ query: { scope, from, to } });
    return data.reviewItems;
  }

  /** Plans an item for the period after the review's. */
  async createItem(
    reviewId: string,
    kind: ReviewItemKind,
    title: string,
  ): Promise<ReviewItem> {
    const { data } = await createReviewItem({
      path: { reviewId },
      body: { reviewItem: { kind, title } },
    });
    return data.reviewItem;
  }

  /** The item with the changes, or undefined when nothing changed. */
  async updateItem(
    itemId: string,
    reviewItem: PartialReviewItem,
  ): Promise<ReviewItem | undefined> {
    const response = await updateReviewItem({
      path: { itemId },
      body: { reviewItem },
      validateStatus: (status) => status === 200 || status === 304,
    });
    return response.status === 304 ? undefined : response.data.reviewItem;
  }

  /**
   * Takes an item off its day, and its block of time with it. The API
   * clears a field given as null; the generated types only know strings.
   */
  async unscheduleItem(itemId: string): Promise<void> {
    await updateReviewItem({
      path: { itemId },
      body: {
        reviewItem: { scheduledOn: null } as unknown as PartialReviewItem,
      },
      validateStatus: (status) => status === 200 || status === 304,
    });
  }

  /** Carries an item on from a review; answers its copy. */
  async carryItem(
    itemId: string,
    reviewId: string,
    scope?: ReviewItemScope,
  ): Promise<ReviewItem> {
    const { data } = await carryReviewItem({
      path: { itemId },
      body: { reviewId, scope },
    });
    return data.reviewItem;
  }

  async deleteItem(itemId: string): Promise<void> {
    await deleteReviewItem({ path: { itemId } });
  }

  /** Puts a period's items of a kind in the order given. */
  async reorderItems(
    scope: ReviewItemScope,
    periodStart: string,
    kind: ReviewItemKind,
    itemIds: string[],
  ): Promise<ReviewItem[]> {
    const { data } = await reorderReviewItems({
      body: { scope, periodStart, kind, itemIds },
    });
    return data.reviewItems;
  }

  /* Summary -------------------------------------------------------------- */

  async getSummary(
    kind: ReviewKind,
    from: string,
    to: string,
  ): Promise<ReviewSummary> {
    const { data } = await getReviewSummary({
      query: { kind, from, to },
      ...this.tz,
    });
    return data.summary;
  }
}

const reviewsApi = new ReviewsApi();
export default reviewsApi;
