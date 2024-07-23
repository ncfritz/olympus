import { Button, Col, Row, Space, Typography } from "antd";
import React, { ReactElement } from "react";
import { EditOutlined } from "@ant-design/icons";

export interface SectionHeadingProps {
  title: string;
  children: React.ReactElement | ReactElement[];
  onEdit?: () => void;
  editing?: boolean;
}

const SectionHeading: React.FunctionComponent<SectionHeadingProps> = ({
  title,
  children,
  onEdit,
  editing,
}) => {
  return (
    <Row
      style={{
        marginBottom: 16,
      }}
    >
      <Col span={24}>
        <Typography.Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            borderBottom: "1px solid #ddd",
            display: "flex",
            flexGrow: 1,
            justifyContent: "space-between",
            marginBottom: 16,
            marginRight: 16,
          }}
        >
          {title}
          {onEdit && !editing && (
            <Button type={"text"} onClick={onEdit} className={"edit_button"}>
              <EditOutlined style={{ fontSize: 24 }} />
            </Button>
          )}
        </Typography.Text>
        {children}
      </Col>
    </Row>
  );
};

export default SectionHeading;
