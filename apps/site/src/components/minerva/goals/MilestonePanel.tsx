import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { FullGoal } from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Checkbox,
  DatePicker,
  Flex,
  Input,
  List,
  message,
  Popconfirm,
  Slider,
  Space,
  Tag,
  Typography,
} from "antd";
import GoalSection from "./GoalSection";
import type { Dayjs } from "dayjs";
import React, { useState } from "react";
import goalsApi from "../../../api/goalsApi";
import { apiProblems, formatDay, formatValue } from "../../../utils/goals";
import { GoalProgress } from "./GoalBits";

const { Text } = Typography;

/**
 * A milestone goal's ordered checklist: tick, add, move and remove steps;
 * the next one undone stands out. A goal set by hand gets a slider instead.
 */
const MilestonePanel: React.FunctionComponent<{
  goal: FullGoal;
  today: string;
  readOnly: boolean;
  onChanged: () => void;
}> = ({ goal, today, readOnly, onChanged }) => {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<Dayjs | null>(null);
  const [manual, setManual] = useState(goal.manualProgress ?? 0);
  const done = goal.milestones.filter((m) => m.done).length;
  const next = goal.milestones.find((m) => !m.done);

  const act = async (work: () => Promise<unknown>) => {
    try {
      await work();
      onChanged();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    }
  };

  const move = (index: number, by: number) => {
    const ids = goal.milestones.map((m) => m.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id);
    void act(() => goalsApi.reorderMilestones(goal.id, ids));
  };

  const add = () => {
    if (!title.trim()) return;
    void act(async () => {
      await goalsApi.createMilestone(goal.id, {
        title: title.trim(),
        dueDate: due ? due.format("YYYY-MM-DD") : undefined,
      });
      setTitle("");
      setDue(null);
    });
  };

  if (goal.progressMode === "manual") {
    return (
      <GoalSection title={"Progress, set by hand"}>
        <GoalProgress goal={goal} size={"default"} />
        <Flex gap={16} align={"center"} style={{ marginTop: 16 }}>
          <Slider
            style={{ flex: 1 }}
            value={manual}
            onChange={setManual}
            disabled={readOnly}
            aria-label={"Progress"}
          />
          <Button
            disabled={readOnly || manual === goal.manualProgress}
            onClick={() =>
              act(() =>
                goalsApi.updateGoal(goal.id, {
                  goal: { manualProgress: manual },
                }),
              )
            }
          >
            Save {manual}%
          </Button>
        </Flex>
      </GoalSection>
    );
  }

  return (
    <GoalSection
      title={
        <Space>
          <span>Milestones</span>
          <Text type={"secondary"}>
            {done} of {goal.milestones.length}
          </Text>
        </Space>
      }
      extra={
        goal.expectedProgress !== undefined && (
          <Text type={"secondary"}>
            {formatValue(goal.progress)}% done · pace{" "}
            {formatValue(goal.expectedProgress)}%
          </Text>
        )
      }
    >
      <GoalProgress goal={goal} size={"default"} />
      <List
        dataSource={goal.milestones}
        locale={{ emptyText: "No milestones yet" }}
        renderItem={(m, index) => (
          <List.Item
            actions={
              readOnly
                ? []
                : [
                    <Button
                      key={"up"}
                      type={"text"}
                      size={"small"}
                      icon={<ArrowUpOutlined />}
                      disabled={index === 0}
                      aria-label={`Move ${m.title} up`}
                      onClick={() => move(index, -1)}
                    />,
                    <Button
                      key={"down"}
                      type={"text"}
                      size={"small"}
                      icon={<ArrowDownOutlined />}
                      disabled={index === goal.milestones.length - 1}
                      aria-label={`Move ${m.title} down`}
                      onClick={() => move(index, 1)}
                    />,
                    <Popconfirm
                      key={"delete"}
                      title={`Remove ${m.title}?`}
                      onConfirm={() =>
                        act(() => goalsApi.deleteMilestone(goal.id, m.id))
                      }
                    >
                      <Button
                        type={"text"}
                        size={"small"}
                        icon={<DeleteOutlined />}
                        aria-label={`Remove ${m.title}`}
                      />
                    </Popconfirm>,
                  ]
            }
          >
            <Flex gap={12} align={"center"} style={{ width: "100%" }}>
              <Checkbox
                checked={m.done}
                disabled={readOnly}
                aria-label={`${m.title} done`}
                onChange={(e) =>
                  act(() =>
                    goalsApi.updateMilestone(goal.id, m.id, {
                      done: e.target.checked,
                    }),
                  )
                }
              />
              <Text
                strong={m.id === next?.id}
                delete={m.done}
                type={m.done ? "secondary" : undefined}
                style={{ flex: 1 }}
              >
                {m.title}
              </Text>
              {m.id === next?.id && <Tag color={"processing"}>Next</Tag>}
              <Text type={"secondary"} style={{ fontSize: 12 }}>
                {formatDay(m.dueDate, today)}
              </Text>
            </Flex>
          </List.Item>
        )}
      />
      {!readOnly && (
        <Space.Compact style={{ width: "100%" }}>
          <Input
            value={title}
            maxLength={120}
            placeholder={"Add a milestone"}
            onChange={(e) => setTitle(e.target.value)}
            onPressEnter={add}
          />
          <DatePicker value={due} onChange={setDue} placeholder={"Due"} />
          <Button icon={<PlusOutlined />} onClick={add}>
            Add
          </Button>
        </Space.Compact>
      )}
    </GoalSection>
  );
};

export default MilestonePanel;
