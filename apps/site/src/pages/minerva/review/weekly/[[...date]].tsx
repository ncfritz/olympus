import { useParams } from "next/navigation";
import React from "react";
import ReviewPlaceholder from "../../../../components/minerva/review/ReviewPlaceholder";
import WeeklyReview from "../../../../components/minerva/review/WeeklyReview";
import { parseReviewRoute } from "../../../../utils/reviews";

/**
 * A week's review, or the weekly list (ADR 0027), routed as
 * docs/plans/activity-review/design.md lays out. The list arrives in
 * phase 6.
 */
const WeeklyReviewPage: React.FunctionComponent = () => {
  const params = useParams<{ date?: string[] }>();
  const route = parseReviewRoute("weekly", params?.date);
  if (route.kind === "weekly" && route.view === "review") {
    return <WeeklyReview key={route.week.toISODate()} week={route.week} />;
  }
  return <ReviewPlaceholder route={route} />;
};

export default WeeklyReviewPage;
