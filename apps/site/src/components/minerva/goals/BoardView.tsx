import { DownOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragOverEvent,
  DragOverlay,
  type DraggableAttributes,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import type { Goal, GoalCategory } from "@ncfritz/olympus-sdk/minerva";
import { Button, Empty, Masonry } from "antd";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useWindowSize } from "usehooks-ts";
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

type CardProps = {
  category: GoalCategory;
  goals: Goal[];
  today: string;
  onAddGoal: (categoryId: string) => void;
};

/**
 * A category's card, as the design board draws it: grey, its colour across
 * the top, its icon, name and health counts, the vision line, its goals
 * as tiles, and a handle to drag it by.
 */
const CategoryCard = React.forwardRef<
  HTMLElement,
  CardProps & {
    handle?: {
      attributes: DraggableAttributes;
      listeners?: ReturnType<typeof useSortable>["listeners"];
    };
    style?: React.CSSProperties;
  }
>(({ category, goals, today, onAddGoal, handle, style }, ref) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const health = (["on_track", "at_risk", "off_track"] as const)
    .map((h) => [h, goals.filter((g) => g.health === h).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <section
      ref={ref}
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
        ...style,
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
          {...handle?.attributes}
          {...handle?.listeners}
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
});
CategoryCard.displayName = "CategoryCard";

/** A card in its place on the board; while dragged, a faint placeholder. */
const SortableCard: React.FunctionComponent<CardProps> = (props) => {
  const sortable = useSortable({ id: props.category.id });
  return (
    <CategoryCard
      {...props}
      ref={sortable.setNodeRef}
      handle={{
        attributes: sortable.attributes,
        listeners: sortable.listeners,
      }}
      style={{ opacity: sortable.isDragging ? 0.35 : 1 }}
    />
  );
};

/** Columns by the window's width: four from 1900 px. */
const columnsFor = (width: number) =>
  width >= 1900 ? 4 : width >= 1600 ? 3 : width >= 992 ? 2 : 1;

/** The pointer's card when it is over one; otherwise the nearest. */
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : closestCenter(args);
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
  const [dragging, setDragging] = useState<string>();
  const { width } = useWindowSize();
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

  // The order changes as a card is dragged over others, so the masonry
  // makes room for it as it goes; it is saved on drop.
  const dragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return;
    setOrder((was) => {
      const from = was.findIndex((c) => c.id === active.id);
      const to = was.findIndex((c) => c.id === over.id);
      return from < 0 || to < 0 ? was : arrayMove(was, from, to);
    });
  };

  const dragEnd = async () => {
    setDragging(undefined);
    const ids = order.map((c) => c.id);
    if (ids.join() === categories.map((c) => c.id).join()) return;
    try {
      await onReorder(ids);
    } catch {
      setOrder(categories);
    }
  };

  const draggingColumn = columns.find((c) => c.category.id === dragging);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => setDragging(String(active.id))}
      onDragOver={dragOver}
      onDragEnd={dragEnd}
      onDragCancel={() => {
        setDragging(undefined);
        setOrder(categories);
      }}
    >
      {/* The masonry places the cards; the dragged card follows the
          pointer in the overlay. */}
      <SortableContext items={order.map((c) => c.id)} strategy={() => null}>
        <Masonry
          columns={columnsFor(width)}
          gutter={16}
          fresh={true}
          items={columns.map(({ category, goals: inCategory }) => ({
            key: category.id,
            data: { category, goals: inCategory },
          }))}
          itemRender={({ data }) => (
            <SortableCard
              category={data.category}
              goals={data.goals}
              today={today}
              onAddGoal={onAddGoal}
            />
          )}
        />
      </SortableContext>
      <DragOverlay>
        {draggingColumn && (
          <CategoryCard
            category={draggingColumn.category}
            goals={draggingColumn.goals}
            today={today}
            onAddGoal={onAddGoal}
            style={{
              boxShadow: "0 6px 16px rgba(0, 0, 0, 0.16)",
              cursor: "grabbing",
            }}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default BoardView;
