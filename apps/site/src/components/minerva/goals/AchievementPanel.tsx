import { TrophyOutlined } from "@ant-design/icons";
import type { Goal } from "@ncfritz/olympus-sdk/minerva";
import { Button, Flex, Statistic, Typography } from "antd";
import GoalSection from "./GoalSection";
import React from "react";
import { daysLeft, formatDay } from "../../../utils/goals";

const { Text } = Typography;

/** An achievement: done or not, the days left, and the way to mark it done. */
const AchievementPanel: React.FunctionComponent<{
  goal: Goal;
  today: string;
  readOnly: boolean;
  onAchieve: () => void;
}> = ({ goal, today, readOnly, onAchieve }) => {
  const left = daysLeft(goal, today);
  const achieved = goal.status === "achieved";
  return (
    <GoalSection title={"Achievement"}>
      <Flex justify={"space-between"} align={"center"} wrap={true} gap={16}>
        <Statistic
          title={achieved ? "Achieved" : "Not achieved yet"}
          value={
            achieved
              ? formatDay(goal.closedOn, today)
              : left === undefined
                ? "No due date"
                : left >= 0
                  ? `${left} days left`
                  : `${-left} days past due`
          }
          prefix={<TrophyOutlined />}
        />
        {!achieved && goal.dueDate && (
          <Text type={"secondary"}>Due {formatDay(goal.dueDate, today)}</Text>
        )}
        {!readOnly && !achieved && (
          <Button
            type={"primary"}
            icon={<TrophyOutlined />}
            onClick={onAchieve}
          >
            Mark achieved
          </Button>
        )}
      </Flex>
    </GoalSection>
  );
};

export default AchievementPanel;
