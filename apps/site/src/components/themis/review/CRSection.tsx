import { Col, Row, Typography } from "antd";
import type { CRReviewResponse } from "../../../pages/api/themis/user/[username]/review/[year]/cr";
import type { CRStat } from "../../../types/themis";
import CRGraph from "../graph/CRGraph";

interface CRSectionProps {
  data: CRReviewResponse;
}

const CRSection: React.FunctionComponent<CRSectionProps> = ({ data }) => {
  return (
    <>
      <CRSectionRow
        stat={"authored"}
        title={"Authored"}
        bottomMargin={32}
        data={data}
      />
      <CRSectionRow
        stat={"commented"}
        title={"Commented"}
        bottomMargin={32}
        data={data}
      />
      <CRSectionRow
        stat={"received"}
        title={"Received"}
        bottomMargin={32}
        data={data}
        max={50}
      />
      <CRSectionRow
        stat={"approved"}
        title={"Approved"}
        bottomMargin={32}
        data={data}
        max={50}
      />
    </>
  );
};

interface CRRowProps {
  title: string;
  bottomMargin?: number;
  stat: keyof CRStat;
  data: CRReviewResponse;
  max?: number;
}
const CRSectionRow: React.FunctionComponent<CRRowProps> = ({
  data,
  stat,
  title,
  bottomMargin = 0,
}) => {
  return (
    <>
      <Row gutter={16} align={"bottom"} style={{ marginBottom: bottomMargin }}>
        <Col span={12} style={{ display: "flex", justifyContent: "center" }}>
          <Typography.Text style={{ fontSize: 20 }}>{title}</Typography.Text>
        </Col>
        <Col span={6}>
          <Typography.Text
            style={{ display: "flex", justifyContent: "center" }}
          >
            Within Team
          </Typography.Text>
        </Col>
        <Col span={6}>
          <Typography.Text
            style={{ display: "flex", justifyContent: "center" }}
          >
            Within Level
          </Typography.Text>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <CRGraph
            axisLabel={title}
            data={data.stats}
            stat={stat}
            inferMax={true}
          />
        </Col>
      </Row>
    </>
  );
};

export default CRSection;
