import { Col, Row, Typography } from "antd";
import type { CRStatsReviewResponse } from "../../../pages/api/themis/user/[username]/review/[year]/cr";
import type { CRStat } from "../../../types/themis";
import CRGraph from "../graph/CRGraph";
import TeamCRGraph from "../graph/TeamCRGraph";

interface CRSectionProps {
  username: string;
  data: CRStatsReviewResponse;
}

const CRSection: React.FunctionComponent<CRSectionProps> = ({
  username,
  data,
}) => {
  return (
    <>
      <CRSectionRow
        username={username}
        stat={"authored"}
        title={"Authored"}
        bottomMargin={32}
        data={data}
      />
      <CRSectionRow
        username={username}
        stat={"commented"}
        title={"Commented"}
        bottomMargin={32}
        data={data}
      />
      <CRSectionRow
        username={username}
        stat={"received"}
        title={"Received"}
        bottomMargin={32}
        data={data}
        max={50}
      />
      <CRSectionRow
        username={username}
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
  username: string;
  bottomMargin?: number;
  stat: keyof CRStat;
  data: CRStatsReviewResponse;
  max?: number;
}
const CRSectionRow: React.FunctionComponent<CRRowProps> = ({
  data,
  username,
  stat,
  title,
  bottomMargin = 0,
  max = 80,
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
        <Col span={6}>
          <TeamCRGraph
            year={data.crYear}
            stat={stat}
            username={username}
            axisLabel={"SLOC"}
            userStats={data.stats[data.crYear]}
            teamStats={data.peerStats}
            max={max}
          />
        </Col>
        <Col span={6}>
          <TeamCRGraph
            year={data.crYear}
            stat={stat}
            username={username}
            axisLabel={"SLOC"}
            userStats={data.stats[data.crYear]}
            teamStats={data.peersInLevelStats}
            max={max}
          />
        </Col>
      </Row>
    </>
  );
};

export default CRSection;
