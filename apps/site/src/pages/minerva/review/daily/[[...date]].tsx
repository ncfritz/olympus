import { useParams } from "next/navigation";
import React from "react";
import ReviewPlaceholder from "../../../../components/minerva/review/ReviewPlaceholder";
import { parseReviewRoute } from "../../../../utils/reviews";

/**
 * The daily review and its list (ADR 0027), routed as
 * docs/plans/activity-review/design.md lays out. Empty until phases 4 to 6.
 */
const DailyReviewPage: React.FunctionComponent = () => {
  const params = useParams<{ date?: string[] }>();
  return <ReviewPlaceholder route={parseReviewRoute("daily", params?.date)} />;
};

export default DailyReviewPage;
