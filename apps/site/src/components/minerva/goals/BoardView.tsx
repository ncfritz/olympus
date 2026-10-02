import { DownOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Goal, GoalCategory } from "@ncfritz/olympus-sdk/minerva";
import { Button, Empty, Masonry } from "antd";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  byCategory,
  dueText,
  goalTree,
  metricText,
} from "../../../utils/goals";
import {
  CategoryIcon,
  GoalTypeIcon,
  HealthDot,
  HealthLabel,
  PaceBar,
} from "./GoalBits";

export interface BoardViewProps {
  goals: Goal[];
  categories: GoalCategory[];
  today: string;
  onAddGoal: (categoryId: string) => void;
  /** The categories in a new order; the caller saves it. */
  onReorder: (categoryIds: string[]) => Promise<void>;
}

/** One goal on a category card: a white tile, indented under its parent. */
const GoalTile: React.FunctionComponent<{
  goal: Goal;
  depth: number;
  hiddenBelow: number;
  today: string;
  onExpand: () => void;
}> = ({ goal, depth, hiddenBelow, today, onExpand }) => (
  <div style={{ marginLeft: depth * 16 }}>
    <Link
      href={`/minerva/goals/${goal.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
        borderRadius: 6,
        border: "1px solid #f0f0f0",
        background: "#ffffff",
        color: "#1f1f1f",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", color: "#595959" }}>
          <GoalTypeIcon type={goal.type} />
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            flexGrow: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={goal.title}
        >
          {goal.title}
        </span>
        <HealthLabel health={goal.health} />
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PaceBar goal={goal} />
        <span
          style={{
            fontSize: 12,
            color: "#595959",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {metricText(goal)}
          {goal.subGoalIds.length > 0 && goal.progressMode !== "subgoals"
            ? ` · ${goal.subGoalIds.length} sub-goal${goal.subGoalIds.length === 1 ? "" : "s"}`
            : ""}
        </span>
      </span>
      <span style={{ fontSize: 12, color: "#6b6b6b" }}>
        {dueText(goal, today)}
      </span>
    </Link>
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
 * A category's card, as the design board draws it: grey, its colour across
 * the top, its icon, name and health counts, the vision line, its goals
 * as tiles. Dragged by its handle to reorder the board.
 */
const CategoryCard: React.FunctionComponent<{
  category: GoalCategory;
  goals: Goal[];
  today: string;
  onAddGoal: (categoryId: string) => void;
}> = ({ category, goals, today, onAddGoal }) => {
  const sortable = useSortable({ id: category.id });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const health = (["on_track", "at_risk", "off_track"] as const)
    .map((h) => [h, goals.filter((g) => g.health === h).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <section
      ref={sortable.setNodeRef}
      aria-label={category.name}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: 4,
        border: "1px solid #e6e6e6",
        borderTop: `3px solid ${category.color}`,
        background: "#fafafa",
        minWidth: 0,
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
        position: "relative",
        zIndex: sortable.isDragging ? 10 : undefined,
        boxShadow: sortable.isDragging
          ? "0 6px 16px rgba(0, 0, 0, 0.12)"
          : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CategoryIcon icon={category.icon} color={category.color} />
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1f1f1f" }}>
          {category.name}
        </span>
        <span style={{ fontSize: 13, color: "#6b6b6b" }}>{goals.length}</span>
        <span style={{ flexGrow: 1 }} />
        {health.map(([h, n]) => (
          <span
            key={h}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "#595959",
            }}
            aria-label={`${n} ${h.replace("_", " ")}`}
          >
            <HealthDot health={h} />
            {n}
          </span>
        ))}
        <Button
          type={"text"}
          size={"small"}
          icon={<HolderOutlined />}
          aria-label={`Move ${category.name}`}
          style={{ cursor: "grab" }}
          {...sortable.attributes}
          {...sortable.listeners}
        />
      </div>
      {category.vision && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.45,
            color: "#595959",
            fontStyle: "italic",
          }}
        >
          “{category.vision}”
        </p>
      )}
      {goals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {goalTree(goals, 3, expanded).map((row) => (
            <GoalTile
              key={row.goal.id}
              {...row}
              today={today}
              onExpand={() =>
                setExpanded((was) => new Set(was).add(row.goal.id))
              }
            />
          ))}
        </div>
      )}
      <Button
        type={"link"}
        size={"small"}
        icon={<PlusOutlined />}
        onClick={() => onAddGoal(category.id)}
        style={{ alignSelf: "flex-start", paddingInline: 0 }}
      >
        Add goal to {category.name}
      </Button>
    </section>
  );
};

/**
 * The Board: one card per category in AntD's masonry, each card's colour,
 * vision line and goals, sub-goals indented three levels deep with a way
 * to go further. Cards reorder by their handle, with a mouse or the
 * keyboard; the new order is saved for the categories everywhere.
 */
const BoardView: React.FunctionComponent<BoardViewProps> = ({
  goals,
  categories,
  today,
  onAddGoal,
  onReorder,
}) => {
  const [order, setOrder] = useState(categories);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => setOrder(categories), [categories]);

  if (categories.length === 0) {
    return <Empty description={"No categories yet"} />;
  }

  const columns = byCategory(goals, order);

  const dragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      order,
      order.findIndex((c) => c.id === active.id),
      order.findIndex((c) => c.id === over.id),
    );
    setOrder(next);
    try {
      await onReorder(next.map((c) => c.id));
    } catch {
      setOrder(categories);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={dragEnd}
    >
      {/* Cards do not shuffle while one is dragged: in a masonry they
          would jump between columns. The order changes on drop. */}
      <SortableContext items={order.map((c) => c.id)} strategy={() => null}>
        <Masonry
          columns={{ xs: 1, lg: 2, xxl: 3 }}
          gutter={16}
          fresh={true}
          items={columns.map(({ category, goals: inCategory }) => ({
            key: category.id,
            data: { category, goals: inCategory },
          }))}
          itemRender={({ data }) => (
            <CategoryCard
              category={data.category}
              goals={data.goals}
              today={today}
              onAddGoal={onAddGoal}
            />
          )}
        />
      </SortableContext>
    </DndContext>
  );
};

export default BoardView;
