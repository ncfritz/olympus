import { CheckCircleFilled, MinusCircleOutlined } from "@ant-design/icons";
import { Col, Result, Row, Space, Spin } from "antd";
import type { DataSummaryResponse } from "../../../pages/api/themis/user/[username]/data/dataSummary";
import { DATA_PATHS, type UserDataSummary } from "../../../types/themis";

export interface DataSummaryPanelProps {
  username: string;
  loading: boolean;
  error: boolean;
  summary?: DataSummaryResponse;
}

const DataSummaryPanel: React.FunctionComponent<DataSummaryPanelProps> = ({
  username,
  loading,
  error,
  summary,
}) => {
  let content;

  if (loading) {
    content = (
      <Space direction={"horizontal"} style={{ width: "100%" }}>
        <Spin />
      </Space>
    );
  } else if (error || !summary) {
    content = <Result status={"error"} title={"Could not load data summary"} />;
  } else {
    content = (
      <Space direction={"vertical"} style={{ width: "100%", rowGap: 0 }}>
        <Row gutter={6}>
          <Col span={5} className={"b-b1"}></Col>
          {Object.keys(summary).map((key) => {
            return (
              <Col
                span={1}
                className={"dataCell b-b1 b-l1"}
                style={{
                  width: 50,
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                {key}
              </Col>
            );
          })}
        </Row>
        {Object.entries(DATA_PATHS).map(([key, value]) => {
          return (
            <Row gutter={6}>
              <Col
                className={"dataCell"}
                span={5}
                style={{
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#999999",
                }}
              >
                {`/olr/${username}/data/<year>/${value}`}
              </Col>
              {Object.keys(summary).map((year) => {
                return (
                  <Col
                    span={1}
                    className={"dataCell b-l1"}
                    style={{
                      width: 50,
                      justifyContent: "center",
                      textAlign: "center",
                    }}
                  >
                    {summary[year][key as keyof UserDataSummary] ? (
                      <CheckCircleFilled style={{ color: "#006600" }} />
                    ) : (
                      <MinusCircleOutlined />
                    )}
                  </Col>
                );
              })}
            </Row>
          );
        })}
      </Space>
    );
  }

  return content;
};
export default DataSummaryPanel;
