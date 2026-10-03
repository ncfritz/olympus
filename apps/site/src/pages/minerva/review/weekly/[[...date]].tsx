import { useParams } from "next/navigation";
import React from "react";
import WeeklyList from "../../../../components/minerva/review/WeeklyList";
import ReviewPlaceholder from "../../../../components/minerva/review/ReviewPlaceholder";
import WeeklyReview from "../../../../components/minerva/review/WeeklyReview";
import { parseReviewRoute } from "../../../../utils/reviews";

/**
 * A week's review, or a month's weekly list (ADR 0027), routed as
 * docs/plans/activity-review/design.md lays out.
 */
const WeeklyReviewPage: React.FunctionComponent = () => {
  const params = useParams<{ date?: string[] }>();
  const route = parseReviewRoute("weekly", params?.date);
  if (route.kind === "weekly" && route.view === "review") {
    return <WeeklyReview key={route.week.toISODate()} week={route.week} />;
  }
  if (route.kind === "weekly" && route.view === "list") {
    return <WeeklyList key={route.month.toISODate()} month={route.month} />;
  }
  return <ReviewPlaceholder route={route} />;
};

export default WeeklyReviewPage;
