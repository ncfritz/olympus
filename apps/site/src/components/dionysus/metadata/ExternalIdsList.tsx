import type { ExternalId } from "@ncfritz/olympus-sdk/dionysus";
import { Button, Col, Empty, Row, Space, Typography } from "antd";
import React from "react";
import Description from "../../common/Description";
import { getExternalIdIcon } from "./util";

export interface ExternalIdsListProps {
  ids: ExternalId[];
}

export const ExternalIdsList: React.FunctionComponent<ExternalIdsListProps> = ({
  ids,
}: ExternalIdsListProps) => {
  let content = <Empty />;

  if (ids && ids.length > 0) {
    content = (
      <Space direction={"vertical"} style={{ width: "100%" }} size={0}>
        {ids.map((item) => {
          return (
            <Row gutter={8} style={{ height: 25, alignItems: "center" }}>
              <Col span={5} style={{ textAlign: "end" }}>
                <Typography.Text style={{ fontSize: "12px" }}>
                  {item.type}:
                </Typography.Text>
              </Col>
              <Col span={15}>
                <Typography.Text
                  style={{
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                >
                  {item.externalId}
                </Typography.Text>
              </Col>
              <Col
                span={4}
                style={{
                  textAlign: "end",
                  paddingRight: 32,
                }}
              >
                <Button
                  icon={getExternalIdIcon(item.type)}
                  type={"text"}
                  size={"small"}
                />
              </Col>
            </Row>
          );
        })}
      </Space>
    );
  }

  return (
    <Description
      title={"External IDs"}
      style={{ width: "100%" }}
      value={content}
    />
  );
};
export default ExternalIdsList;
