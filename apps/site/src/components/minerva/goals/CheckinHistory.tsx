import { DeleteOutlined } from "@ant-design/icons";
import type { Goal, GoalCheckin } from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Empty,
  Flex,
  List,
  message,
  Popconfirm,
  Typography,
} from "antd";
import React from "react";
import goalsApi from "../../../api/goalsApi";
import { apiProblems, formatDay, formatValue } from "../../../utils/goals";
import { HealthTag } from "./GoalBits";

const { Text, Paragraph } = Typography;

const SOURCE: Record<GoalCheckin["source"], string> = {
  goal: "Goal page",
  daily_review: "Daily review",
  weekly_review: "Weekly review",
};

/** A goal's check-ins, latest first, each with where it was made. */
const CheckinHistory: React.FunctionComponent<{
  goal: Goal;
  checkins: GoalCheckin[];
  today: string;
  onChanged: () => void;
}> = ({ goal, checkins, today, onChanged }) => {
  if (checkins.length === 0) return <Empty description={"No check-ins yet"} />;
  return (
    <List
      size={"small"}
      dataSource={checkins}
      renderItem={(c) => (
        <List.Item
          actions={[
            <Popconfirm
              key={"delete"}
              title={"Remove this check-in?"}
              onConfirm={async () => {
                try {
                  await goalsApi.deleteCheckin(goal.id, c.id);
                  onChanged();
                } catch (error) {
                  message.error(apiProblems(error).join("; "));
                }
              }}
            >
              <Button
                type={"text"}
                size={"small"}
                icon={<DeleteOutlined />}
                aria-label={`Remove the check-in of ${c.checkinDate}`}
              />
            </Popconfirm>,
          ]}
        >
          <Flex vertical={true} style={{ width: "100%" }}>
            <Flex gap={8} align={"center"} wrap={true}>
              <Text strong={true}>{formatDay(c.checkinDate, today)}</Text>
              {c.value !== undefined && (
                <Text>
                  {formatValue(c.value)}
                  {goal.unit ? ` ${goal.unit}` : ""}
                </Text>
              )}
              <HealthTag health={c.confidence} />
            </Flex>
            {c.note && (
              <Paragraph
                style={{ margin: 0 }}
                ellipsis={{ rows: 3, expandable: true }}
              >
                {c.note}
              </Paragraph>
            )}
            <Text type={"secondary"} style={{ fontSize: 12 }}>
              From {SOURCE[c.source]}
            </Text>
          </Flex>
        </List.Item>
      )}
    />
  );
};

export default CheckinHistory;
