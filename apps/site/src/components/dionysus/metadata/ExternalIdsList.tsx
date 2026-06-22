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
      <Space orientation={"vertical"} style={{ width: "100%" }} size={0}>
        {ids.map((item) => {
          return (
            <Space
              orientation={"horizontal"}
              style={{
                height: 25,
                alignItems: "center",
                width: "100%",
                justifyContent: "space-between",
              }}
            >
              <Space style={{ textAlign: "end", width: 90 }}>
                <Typography.Text style={{ fontSize: "11px" }}>
                  {item.type}:
                </Typography.Text>
              </Space>
              <Space orientation={"horizontal"} size={8}>
                <Typography.Text
                  style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                  }}
                >
                  {item.externalId}
                </Typography.Text>
                <Button
                  icon={getExternalIdIcon(item.type)}
                  type={"text"}
                  size={"small"}
                />
              </Space>
            </Space>
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
