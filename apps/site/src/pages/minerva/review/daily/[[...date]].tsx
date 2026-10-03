import { useParams } from "next/navigation";
import React from "react";
import DailyList from "../../../../components/minerva/review/DailyList";
import DailyReview from "../../../../components/minerva/review/DailyReview";
import ReviewPlaceholder from "../../../../components/minerva/review/ReviewPlaceholder";
import { parseReviewRoute } from "../../../../utils/reviews";

/**
 * A day's review, or a week's daily list (ADR 0027), routed as
 * docs/plans/activity-review/design.md lays out.
 */
const DailyReviewPage: React.FunctionComponent = () => {
  const params = useParams<{ date?: string[] }>();
  const route = parseReviewRoute("daily", params?.date);
  if (route.kind === "daily" && route.view === "review") {
    return <DailyReview key={route.day.toISODate()} date={route.day} />;
  }
  if (route.kind === "daily" && route.view === "list") {
    return <DailyList key={route.week.toISODate()} week={route.week} />;
  }
  return <ReviewPlaceholder route={route} />;
};

export default DailyReviewPage;
