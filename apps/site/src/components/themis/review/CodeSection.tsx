import { Col, Row, Typography } from "antd";
import type { CodeStatsReviewResponse } from "../../../pages/api/themis/user/[username]/review/[year]/code";
import type { CodeStat } from "../../../types/themis";
import CodeGraph from "../graph/CodeGraph";
import TeamCodeGraph from "../graph/TeamCodeGraph";

interface CodeSectionProps {
  username: string;
  data: CodeStatsReviewResponse;
}

const CodeSection: React.FunctionComponent<CodeSectionProps> = ({
  username,
  data,
}) => {
  return (
    <>
      <CodeSectionRow
        username={username}
        stat={"added"}
        title={"SLOC Added"}
        bottomMargin={32}
        data={data}
      />
      <CodeSectionRow
        username={username}
        stat={"removed"}
        title={"SLOC Removed"}
        bottomMargin={32}
        data={data}
      />
      <CodeSectionRow
        username={username}
        stat={"changes"}
        title={"Changes"}
        bottomMargin={32}
        data={data}
        max={50}
      />
      <CodeSectionRow
        username={username}
        stat={"packages"}
        title={"Packages"}
        bottomMargin={32}
        data={data}
        max={50}
      />
    </>
  );
};

interface CodeSectionRowProps {
  title: string;
  username: string;
  bottomMargin?: number;
  stat: keyof CodeStat;
  data: CodeStatsReviewResponse;
  max?: number;
}
const CodeSectionRow: React.FunctionComponent<CodeSectionRowProps> = ({
  data,
  stat,
  title,
  username,
  bottomMargin = 0,
  max = 10000,
}) => {
  console.log(data);

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
          <CodeGraph
            axisLabel={title}
            data={data.stats}
            stat={stat}
            inferMax={true}
            max={max}
          />
        </Col>
        <Col span={6}>
          <TeamCodeGraph
            year={data.codeYear}
            stat={stat}
            username={username}
            axisLabel={"SLOC"}
            userStats={data.stats[data.codeYear]}
            teamStats={data.peerStats}
            max={max}
          />
        </Col>
        <Col span={6}>
          <TeamCodeGraph
            year={data.codeYear}
            stat={stat}
            username={username}
            axisLabel={"SLOC"}
            userStats={data.stats[data.codeYear]}
            teamStats={data.peersInLevelStats}
            max={max}
          />
        </Col>
      </Row>
    </>
  );
};

export default CodeSection;
