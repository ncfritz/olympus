import { DownOutlined, PlusOutlined } from "@ant-design/icons";
import type { Goal, GoalCategory } from "@ncfritz/olympus-sdk/minerva";
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Space,
  Typography,
} from "antd";
import Link from "next/link";
import React, { useState } from "react";
import {
  byCategory,
  dueText,
  goalTree,
  HEALTH,
  metricText,
} from "../../../utils/goals";
import {
  CategoryIcon,
  GoalProgress,
  GoalTypeIcon,
  HealthTag,
} from "./GoalBits";

const { Text, Paragraph } = Typography;

export interface BoardViewProps {
  goals: Goal[];
  categories: GoalCategory[];
  today: string;
  onAddGoal: (categoryId: string) => void;
}

/** One goal on a category card, indented under its parent. */
const BoardRow: React.FunctionComponent<{
  goal: Goal;
  depth: number;
  hiddenBelow: number;
  today: string;
  onExpand: () => void;
}> = ({ goal, depth, hiddenBelow, today, onExpand }) => (
  <div style={{ paddingLeft: depth * 20, paddingBlock: 8 }}>
    <Flex align={"center"} gap={8}>
      <GoalTypeIcon type={goal.type} />
      <Link href={`/minerva/goals/${goal.id}`} style={{ flex: 1, minWidth: 0 }}>
        <Text strong={depth === 0} ellipsis={{ tooltip: goal.title }}>
          {goal.title}
        </Text>
      </Link>
      <HealthTag health={goal.health} />
    </Flex>
    <GoalProgress goal={goal} />
    <Flex justify={"space-between"} gap={8}>
      <Text type={"secondary"} style={{ fontSize: 12 }}>
        {metricText(goal)}
        {goal.subGoalIds.length > 0 && goal.progressMode !== "subgoals"
          ? ` · ${goal.subGoalIds.length} sub-goal${goal.subGoalIds.length === 1 ? "" : "s"}`
          : ""}
      </Text>
      <Text type={"secondary"} style={{ fontSize: 12 }}>
        {dueText(goal, today)}
      </Text>
    </Flex>
    {hiddenBelow > 0 && (
      <Button
        type={"link"}
        size={"small"}
        icon={<DownOutlined />}
        onClick={onExpand}
        style={{ paddingInline: 0 }}
      >
        {hiddenBelow} more below
      </Button>
    )}
  </div>
);

/**
 * The Board: one card per category, its colour, vision line and goals,
 * sub-goals indented three levels deep with a way to go further.
 */
const BoardView: React.FunctionComponent<BoardViewProps> = ({
  goals,
  categories,
  today,
  onAddGoal,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const columns = byCategory(goals, categories);

  if (categories.length === 0) {
    return <Empty description={"No categories yet"} />;
  }

  return (
    <Row gutter={[16, 16]}>
      {columns.map(({ category, goals: inCategory }) => {
        const health = (["off_track", "at_risk", "on_track"] as const).map(
          (h) => [h, inCategory.filter((g) => g.health === h).length] as const,
        );
        return (
          <Col key={category.id} xs={24} lg={12} xxl={8}>
            <Card
              size={"small"}
              style={{
                // As a note's coloured edge: the radius no wider than the
                // border, so its inner side stays straight.
                borderTop: `6px solid ${category.color}`,
                borderRadius: 4,
                height: "100%",
              }}
              title={
                <Space>
                  <CategoryIcon icon={category.icon} color={category.color} />
                  <span>{category.name}</span>
                  <Text type={"secondary"}>{inCategory.length}</Text>
                </Space>
              }
              extra={
                <Space size={4}>
                  {health
                    .filter(([, n]) => n > 0)
                    .map(([h, n]) => (
                      <Badge
                        key={h}
                        status={
                          HEALTH[h].color === "error"
                            ? "error"
                            : HEALTH[h].color === "warning"
                              ? "warning"
                              : "success"
                        }
                        text={
                          <Text type={"secondary"} style={{ fontSize: 12 }}>
                            {n} {HEALTH[h].label.toLowerCase()}
                          </Text>
                        }
                      />
                    ))}
                </Space>
              }
            >
              {category.vision && (
                <Paragraph type={"secondary"} italic={true}>
                  “{category.vision}”
                </Paragraph>
              )}
              {goalTree(inCategory, 3, expanded).map((row) => (
                <BoardRow
                  key={row.goal.id}
                  {...row}
                  today={today}
                  onExpand={() =>
                    setExpanded((was) => new Set(was).add(row.goal.id))
                  }
                />
              ))}
              <Button
                type={"dashed"}
                block={true}
                icon={<PlusOutlined />}
                onClick={() => onAddGoal(category.id)}
                style={{ marginTop: 8 }}
              >
                Add goal to {category.name}
              </Button>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};

export default BoardView;
