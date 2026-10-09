import {
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FullGoal, GoalMilestone } from "@ncfritz/olympus-sdk/minerva";
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
import React, { useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import { apiProblems, formatDay, formatValue } from "../../../utils/goals";
import { GoalProgress } from "./GoalBits";

const { Text } = Typography;

/**
 * One milestone: a drag handle, then its tick, title, a Next tag on the
 * first undone, its due day and a remove button.
 */
const MilestoneRow: React.FunctionComponent<{
  milestone: GoalMilestone;
  isNext: boolean;
  today: string;
  readOnly: boolean;
  onDone: (done: boolean) => void;
  onRemove: () => void;
}> = ({ milestone: m, isNext, today, readOnly, onDone, onRemove }) => {
  const sortable = useSortable({ id: m.id, disabled: readOnly });
  return (
    <List.Item
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
        position: "relative",
        zIndex: sortable.isDragging ? 2 : undefined,
        background: sortable.isDragging ? "#ffffff" : undefined,
        boxShadow: sortable.isDragging
          ? "0 6px 16px rgba(0, 0, 0, 0.12)"
          : undefined,
      }}
      actions={
        readOnly
          ? []
          : [
              <Popconfirm
                key={"delete"}
                title={`Remove ${m.title}?`}
                onConfirm={onRemove}
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
      <Flex gap={8} align={"center"} style={{ width: "100%" }}>
        {!readOnly && (
          <Button
            type={"text"}
            size={"small"}
            icon={<HolderOutlined />}
            aria-label={`Move ${m.title}`}
            style={{ cursor: "grab", flexShrink: 0 }}
            {...sortable.attributes}
            {...sortable.listeners}
          />
        )}
        <Checkbox
          checked={m.done}
          disabled={readOnly}
          aria-label={`${m.title} done`}
          onChange={(e) => onDone(e.target.checked)}
        />
        <Text
          strong={isNext}
          delete={m.done}
          type={m.done ? "secondary" : undefined}
          style={{ flex: 1, marginLeft: 4 }}
        >
          {m.title}
        </Text>
        {isNext && <Tag color={"processing"}>Next</Tag>}
        <Text type={"secondary"} style={{ fontSize: 12 }}>
          {formatDay(m.dueDate, today)}
        </Text>
      </Flex>
    </List.Item>
  );
};

/**
 * A milestone goal's ordered checklist: add steps at the top, tick them,
 * drag them into order and remove them; the next one undone stands out. A goal set by hand gets a slider instead.
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
  // The order shown: moved at once on a drop, then saved.
  const [order, setOrder] = useState(goal.milestones);
  useEffect(() => setOrder(goal.milestones), [goal.milestones]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const done = order.filter((m) => m.done).length;
  const next = order.find((m) => !m.done);

  const act = async (work: () => Promise<unknown>) => {
    try {
      await work();
      onChanged();
    } catch (error) {
      message.error(apiProblems(error).join("; "));
    }
  };

  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const moved = arrayMove(
      order,
      order.findIndex((m) => m.id === active.id),
      order.findIndex((m) => m.id === over.id),
    );
    setOrder(moved);
    void act(async () => {
      try {
        await goalsApi.reorderMilestones(
          goal.id,
          moved.map((m) => m.id),
        );
      } catch (error) {
        setOrder(goal.milestones);
        throw error;
      }
    });
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
      {!readOnly && (
        <Space.Compact style={{ width: "100%", marginTop: 16 }}>
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
      >
        <SortableContext
          items={order.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <List
            style={{ marginTop: readOnly ? 16 : 8 }}
            dataSource={order}
            rowKey={(m) => m.id}
            locale={{ emptyText: "No milestones yet" }}
            renderItem={(m) => (
              <MilestoneRow
                milestone={m}
                isNext={m.id === next?.id}
                today={today}
                readOnly={readOnly}
                onDone={(checked) =>
                  act(() =>
                    goalsApi.updateMilestone(goal.id, m.id, { done: checked }),
                  )
                }
                onRemove={() =>
                  act(() => goalsApi.deleteMilestone(goal.id, m.id))
                }
              />
            )}
          />
        </SortableContext>
      </DndContext>
    </GoalSection>
  );
};

export default MilestonePanel;
