import { Col, Row } from "antd";
import type { ExtendedReviewRating } from "../../../types/themis";
import PerformanceHistory from "../rating/PerformanceHistory";
import SectionHeading from "./SectionHeading";

export interface PerformanceHistorySectionProps {
  reviews?: ExtendedReviewRating[];
}

const PerformanceHistorySection = ({
  reviews,
}: PerformanceHistorySectionProps) => {
  let content = <></>;

  if (reviews && reviews.length > 0) {
    content = (
      <Row
        style={{
          marginBottom: 16,
        }}
      >
        <Col span={24}>
          <SectionHeading title={"Performance History"}>
            <PerformanceHistory data={reviews} />
          </SectionHeading>
        </Col>
      </Row>
    );
  }

  return content;
};
export default PerformanceHistorySection;
