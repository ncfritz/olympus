import { Empty, Flex } from "antd";
import React from "react";
import { type ReviewRoute, reviewRouteLabel } from "../../../utils/reviews";
import ReviewBreadcrumbs from "./ReviewBreadcrumbs";

export interface ReviewPlaceholderProps {
  route: ReviewRoute;
}

const WHAT: Record<ReviewRoute["kind"], string> = {
  daily: "Daily review",
  weekly: "Weekly review",
};

/**
 * Where a review page stands until docs/plans/activity-review builds it
 * (the weekly review in phase 5, the lists in phase 6): the breadcrumbs for
 * the route, and what will be there.
 */
const ReviewPlaceholder: React.FunctionComponent<ReviewPlaceholderProps> = ({
  route,
}) => {
  const label = reviewRouteLabel(route);
  let description: string;
  if (route.view === "invalid") {
    description = "There is no review at this address.";
  } else if (route.view === "list") {
    description = `The ${WHAT[route.kind].toLowerCase()}s of ${label} are on their way.`;
  } else {
    description = `The ${WHAT[route.kind].toLowerCase()} of ${label} is on its way.`;
  }

  return (
    <>
      <ReviewBreadcrumbs what={WHAT[route.kind]} label={label} />
      <Flex vertical={true} align={"center"} justify={"center"} flex={1}>
        <Empty description={description} />
      </Flex>
    </>
  );
};

export default ReviewPlaceholder;
