import { ReviewKind, ReviewSummary } from "@ncfritz/olympus-model";
import { BadRequestException, Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  checkTimezone,
  daysBetween,
  isIsoDate,
  isMonday,
  todayIn,
} from "../../utils/localDates";
import { checkEnum } from "../../utils/validation";
import {
  previousRange,
  summarise,
  type SummaryReview,
} from "../summary/summary";
import { ratingOf } from "../converters/ReviewConverter";
import { currentPeriodStart } from "../utils/periods";

/** The longest range a summary covers, in days: a little over a year. */
const MAX_RANGE_DAYS = 400;
/** How far back a current streak is followed, in periods. */
const MAX_STREAK = 1000;

type GraphQlSummaryReview = {
  id: string;
  periodStart: string;
  completedTime: string | null;
  overall: number | null;
  mood: number | null;
  energy: number | null;
  focus: number | null;
  progress: number | null;
  balance: number | null;
  answers: { promptId: string; body: string; position: number }[];
};

/**
 * A user's reviews of a range summarised (ADR 0027): one read of the rows,
 * the rules in `summary/`. Scoped to the caller.
 */
@Injectable()
export class ReviewSummaryService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * The summary of a kind's periods whose starts run from `from` to `to`:
   * days, or weeks named by their Mondays. Today comes from `tz`.
   */
  async summarise(
    userId: string,
    kind: unknown,
    from: unknown,
    to: unknown,
    tz: string,
  ): Promise<ReviewSummary> {
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
      if (kind === ReviewKind.Weekly && !(isMonday(from) && isMonday(to))) {
        problems.push("from and to must be Mondays for weeks");
      }
    }
    if (problems.length) throw new BadRequestException(problems);
    const reviewKind = kind as ReviewKind;
    const today = todayIn(checkTimezone(tz));
    const current = currentPeriodStart(reviewKind, today);
    const before = previousRange(reviewKind, from as string, to as string);

    const document = gql`
      query GetReviewSummary(
        $userId: uuid!
        $kind: String!
        $from: date!
        $to: date!
        $current: date!
        $streak: Int!
      ) {
        reviews: minerva_reviews(
          where: {
            userId: { _eq: $userId }
            kind: { _eq: $kind }
            periodStart: { _gte: $from, _lte: $to }
          }
          order_by: { periodStart: asc }
        ) {
          id
          periodStart
          completedTime
          overall
          mood
          energy
          focus
          progress
          balance
          answers(order_by: { position: asc }) {
            promptId
            body
            position
          }
        }
        prompts: minerva_review_prompts(
          where: {
            userId: { _eq: $userId }
            kind: { _eq: $kind }
            section: { _eq: "reflect" }
          }
          order_by: { position: asc }
        ) {
          id
        }
        completed: minerva_reviews(
          where: {
            userId: { _eq: $userId }
            kind: { _eq: $kind }
            periodStart: { _lte: $current }
            completedTime: { _is_null: false }
          }
          order_by: { periodStart: desc }
          limit: $streak
        ) {
          periodStart
        }
      }
    `;
    type Result = {
      reviews: GraphQlSummaryReview[];
      prompts: { id: string }[];
      completed: { periodStart: string }[];
    };
    const result = await this.graphQLClient.request<Result>(document, {
      userId,
      kind,
      from: before.from,
      to,
      current,
      streak: MAX_STREAK,
    });

    const reviews: SummaryReview[] = result.reviews.map((row) => ({
      id: row.id,
      periodStart: row.periodStart,
      completed: row.completedTime !== null,
      ratings: {
        overall: ratingOf(row.overall) ?? null,
        mood: ratingOf(row.mood) ?? null,
        energy: ratingOf(row.energy) ?? null,
        focus: ratingOf(row.focus) ?? null,
        progress: ratingOf(row.progress) ?? null,
        balance: ratingOf(row.balance) ?? null,
      },
      answers: row.answers,
    }));
    return summarise({
      kind: reviewKind,
      from: from as string,
      to: to as string,
      today,
      reviews,
      reflectPromptIds: result.prompts.map((p) => p.id),
      completedStarts: result.completed.map((c) => c.periodStart),
    });
  }
}
