import { ArrowRightOutlined, DeleteOutlined } from "@ant-design/icons";
import type { MailLabelFamily } from "@ncfritz/olympus-sdk/minerva";
import { Button, Card, Popconfirm, Space, Typography } from "antd";
import React from "react";
import StateTag from "./StateTag";

const { Text } = Typography;

/** A family: its states, initial first, and the moves it allows. */
const FamilyCard: React.FunctionComponent<{
  family: MailLabelFamily;
  onDelete: () => Promise<void>;
}> = ({ family, onDelete }) => {
  const name = (id: string) =>
    family.states.find((s) => s.labelId === id)?.name ?? id;
  const states = [...family.states].sort(
    (a, b) =>
      Number(b.labelId === family.initialLabelId) -
        Number(a.labelId === family.initialLabelId) ||
      Number(b.open) - Number(a.open),
  );
  return (
    <Card
      size={"small"}
      title={family.name}
      extra={
        <Popconfirm
          title={`Delete the ${family.name} family?`}
          description={"Its states become ordinary labels again."}
          okText={"Delete"}
          onConfirm={onDelete}
        >
          <Button type={"text"} size={"small"} icon={<DeleteOutlined />} />
        </Popconfirm>
      }
    >
      <Space direction={"vertical"} size={8}>
        <Space wrap={true} size={4}>
          {states.map((s) => (
            <StateTag
              key={s.labelId}
              name={s.name}
              open={s.open}
              initial={s.labelId === family.initialLabelId}
            />
          ))}
        </Space>
        {family.transitions.length === 0 ? (
          <Text type={"secondary"}>No moves between states.</Text>
        ) : (
          family.transitions.map((t) => (
            <Text
              key={`${t.fromLabelId}\u0000${t.toLabelId}`}
              type={"secondary"}
            >
              {name(t.fromLabelId)} <ArrowRightOutlined /> {name(t.toLabelId)}
            </Text>
          ))
        )}
      </Space>
    </Card>
  );
};

export default FamilyCard;
