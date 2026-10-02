import { useParams } from "next/navigation";
import React from "react";
import DailyReview from "../../../../components/minerva/review/DailyReview";
import ReviewPlaceholder from "../../../../components/minerva/review/ReviewPlaceholder";
import { parseReviewRoute } from "../../../../utils/reviews";

/**
 * A day's review, or the daily list (ADR 0027), routed as
 * docs/plans/activity-review/design.md lays out. The list arrives in
 * phase 6.
 */
const DailyReviewPage: React.FunctionComponent = () => {
  const params = useParams<{ date?: string[] }>();
  const route = parseReviewRoute("daily", params?.date);
  if (route.kind === "daily" && route.view === "review") {
    return <DailyReview key={route.day.toISODate()} date={route.day} />;
  }
  return <ReviewPlaceholder route={route} />;
};

export default DailyReviewPage;
