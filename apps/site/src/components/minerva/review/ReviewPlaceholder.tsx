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
 * A review address that names no review and no list: the breadcrumbs for
 * the kind, and the word that there is nothing there.
 */
const ReviewPlaceholder: React.FunctionComponent<ReviewPlaceholderProps> = ({
  route,
}) => (
  <>
    <ReviewBreadcrumbs
      what={WHAT[route.kind]}
      label={reviewRouteLabel(route)}
    />
    <Flex vertical={true} align={"center"} justify={"center"} flex={1}>
      <Empty description={"There is no review at this address."} />
    </Flex>
  </>
);

export default ReviewPlaceholder;
