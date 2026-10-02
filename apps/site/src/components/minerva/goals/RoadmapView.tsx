import {
  CaretDownOutlined,
  CaretRightOutlined,
  HolderOutlined,
  LeftOutlined,
  RightOutlined,
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
import type {
  Goal,
  GoalCategory,
  GoalCycle,
  GoalMilestone,
} from "@ncfritz/olympus-sdk/minerva";
import { Button, Empty, Flex, Space, Tooltip, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import {
  type Band,
  bandSegments,
  byCategory,
  cycleBands,
  dueText,
  formatDay,
  goalTree,
  HEALTH,
  metricText,
  quarterBands,
  roadmapMark,
  spanFraction,
} from "../../../utils/goals";
import { CategoryIcon } from "./GoalBits";

const { Text } = Typography;

const LABEL = 240;
const LABEL_MIN = 160;
const LABEL_MAX = 560;
const LABEL_KEY = "minerva.goals.roadmap.labelWidth";

/** How wide the goal column is; the divider beside it sets this. */
const LabelWidth = React.createContext(LABEL);

const clampLabel = (width: number) =>
  Math.round(Math.min(LABEL_MAX, Math.max(LABEL_MIN, width)));
const ROW = 30;

const HEALTH_COLOR = {
  on_track: "#52c41a",
  at_risk: "#faad14",
  off_track: "#ff4d4f",
} as const;

const pct = (f: number) => `${f * 100}%`;

/**
 * A row of labelled bands across the year: quarters, or cycles with their
 * buffer hatched. Pieces that meet have square corners between them.
 */
const BandRow: React.FunctionComponent<{ title: string; bands: Band[] }> = ({
  title,
  bands,
}) => (
  <Flex style={{ height: 24 }}>
    <Text
      type={"secondary"}
      ellipsis={true}
      style={{
        width: React.useContext(LabelWidth),
        flexShrink: 0,
        paddingRight: 8,
        fontSize: 12,
      }}
    >
      {title}
    </Text>
    <div style={{ position: "relative", flex: 1 }}>
      {bandSegments(bands).map((piece) => {
        const radius = `${piece.roundLeft ? 4 : 0}px ${piece.roundRight ? 4 : 0}px ${piece.roundRight ? 4 : 0}px ${piece.roundLeft ? 4 : 0}px`;
        const box: React.CSSProperties = {
          position: "absolute",
          left: pct(piece.from),
          width: pct(piece.to - piece.from),
          top: 2,
          bottom: 2,
          borderRadius: radius,
        };
        return piece.kind === "buffer" ? (
          <Tooltip
            key={`${piece.label}-buffer`}
            title={`${piece.label} buffer`}
          >
            <div
              aria-label={`${piece.label} buffer`}
              style={{
                ...box,
                background:
                  "repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 3px, #fff 3px, #fff 6px)",
                border: "1px solid #d9d9d9",
                borderLeft: "none",
              }}
            />
          </Tooltip>
        ) : (
          <div
            key={piece.label}
            style={{
              ...box,
              background: "#f0f5ff",
              border: "1px solid #d6e4ff",
              borderLeft: piece.roundLeft ? "1px solid #d6e4ff" : "none",
              fontSize: 12,
              paddingInline: 6,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {piece.label}
          </div>
        );
      })}
    </div>
  </Flex>
);

/** One goal's mark: a bar filled to progress, a dashed ongoing line, or a diamond. */
const GoalMark: React.FunctionComponent<{
  goal: Goal;
  year: number;
  today: string;
}> = ({ goal, year, today }) => {
  const mark = roadmapMark(goal, year);
  if (!mark) return null;
  const color = goal.health ? HEALTH_COLOR[goal.health] : "#8c8c8c";
  const tip = `${goal.title}: ${metricText(goal)} · ${dueText(goal, today)}${goal.health ? ` · ${HEALTH[goal.health].label}` : ""}`;
  if (mark.kind === "diamond") {
    return (
      <Tooltip title={tip}>
        <div
          role={"img"}
          aria-label={tip}
          style={{
            position: "absolute",
            left: pct(mark.at),
            top: ROW / 2 - 6,
            width: 12,
            height: 12,
            marginLeft: -6,
            transform: "rotate(45deg)",
            background: goal.status === "achieved" ? color : "#fff",
            border: `2px solid ${color}`,
          }}
        />
      </Tooltip>
    );
  }
  if (mark.kind === "ongoing") {
    return (
      <Tooltip title={tip}>
        <div
          role={"img"}
          aria-label={tip}
          style={{
            position: "absolute",
            left: pct(mark.from),
            right: 0,
            top: ROW / 2 - 1,
            borderTop: `3px dashed ${color}`,
          }}
        />
      </Tooltip>
    );
  }
  return (
    <Tooltip title={tip}>
      <div
        role={"img"}
        aria-label={tip}
        style={{
          position: "absolute",
          left: pct(mark.from),
          width: pct(mark.to - mark.from),
          top: 6,
          height: ROW - 12,
          border: `1px solid ${color}`,
          borderRadius: 4,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: pct(Math.min(1, mark.filled)),
            height: "100%",
            background: color,
            opacity: 0.55,
          }}
        />
      </div>
    </Tooltip>
  );
};

export interface RoadmapViewProps {
  goals: Goal[];
  categories: GoalCategory[];
  cycles: GoalCycle[];
  today: string;
  /** The year shown; the page's legend row moves it. */
  year: number;
  /** The categories in a new order; the caller saves it. */
  onReorder: (categoryIds: string[]) => Promise<void>;
}

/** What the roadmap's marks mean. */
export const RoadmapLegend: React.FunctionComponent = () => (
  <Flex gap={16} style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
    {[
      "▭ Start to due date, filled to progress",
      "┄ Ongoing habit",
      "◇ Achievement date",
      "● Milestone",
      "▨ Cycle buffer week",
    ].map((item) => (
      <Text key={item} type={"secondary"} style={{ fontSize: 12 }}>
        {item}
      </Text>
    ))}
  </Flex>
);

/** The roadmap's year, a step back or on, for the page's legend row. */
export const YearSelector: React.FunctionComponent<{
  year: number;
  onYear: (year: number) => void;
}> = ({ year, onYear }) => (
  <Space size={4}>
    <Button
      type={"text"}
      size={"small"}
      icon={<LeftOutlined />}
      aria-label={"Previous year"}
      onClick={() => onYear(year - 1)}
    />
    <Text strong={true} style={{ fontSize: 13 }}>
      {year} roadmap
    </Text>
    <Button
      type={"text"}
      size={"small"}
      icon={<RightOutlined />}
      aria-label={"Next year"}
      onClick={() => onYear(year + 1)}
    />
  </Space>
);

/** A milestone's mark: a dot on its due date, filled once done. */
const MilestoneMark: React.FunctionComponent<{
  milestone: GoalMilestone;
  year: number;
  today: string;
}> = ({ milestone, year, today }) => {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  if (
    !milestone.dueDate ||
    milestone.dueDate < from ||
    milestone.dueDate > to
  ) {
    return null;
  }
  const tip = `${milestone.title}: ${milestone.done ? "done" : `due ${formatDay(milestone.dueDate, today)}`}`;
  return (
    <Tooltip title={tip}>
      <div
        role={"img"}
        aria-label={tip}
        style={{
          position: "absolute",
          left: pct(spanFraction(milestone.dueDate, from, to)),
          top: ROW / 2 - 5,
          width: 10,
          height: 10,
          marginLeft: -5,
          borderRadius: 5,
          border: "2px solid #4096ff",
          background: milestone.done ? "#4096ff" : "#ffffff",
        }}
      />
    </Tooltip>
  );
};

/** The label column's steps: a caret, an icon, and each level of nesting. */
const STEP = 22;

/** An expand caret. */
const Caret: React.FunctionComponent<{
  open: boolean;
  label: string;
  onClick: () => void;
}> = ({ open, label, onClick }) => (
  <Button
    type={"text"}
    size={"small"}
    icon={open ? <CaretDownOutlined /> : <CaretRightOutlined />}
    aria-expanded={open}
    aria-label={label}
    onClick={onClick}
    style={{
      width: STEP,
      minWidth: STEP,
      height: STEP,
      padding: 0,
      flexShrink: 0,
    }}
  />
);

/**
 * A category's lane: its heading (a caret to collapse it, its icon and
 * name, a handle to drag it by) and its goals, sub-goals indented under
 * their parents and a milestone goal's steps a caret away. A goal's caret
 * and title line up with the heading's icon and name.
 */
const Lane: React.FunctionComponent<{
  category: GoalCategory;
  goals: Goal[];
  year: number;
  today: string;
  collapsed: boolean;
  onCollapse: () => void;
  open: Set<string>;
  milestones: Map<string, GoalMilestone[]>;
  onToggleGoal: (goal: Goal) => void;
}> = ({
  category,
  goals,
  year,
  today,
  collapsed,
  onCollapse,
  open,
  milestones,
  onToggleGoal,
}) => {
  const sortable = useSortable({ id: category.id });
  const label = React.useContext(LabelWidth);
  const hasMilestones = (goal: Goal) =>
    goal.type === "milestone" && goal.progressMode === "milestones";

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        borderBottom: "1px solid #f0f0f0",
        paddingBlock: 4,
        // See-through so the month lines show, except while it is lifted.
        background: sortable.isDragging ? "#ffffff" : undefined,
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
        position: "relative",
        zIndex: sortable.isDragging ? 2 : undefined,
        boxShadow: sortable.isDragging
          ? "0 6px 16px rgba(0, 0, 0, 0.12)"
          : undefined,
      }}
    >
      <Flex
        align={"center"}
        style={{ width: label, flexShrink: 0, height: 26, paddingRight: 8 }}
      >
        <Button
          type={"text"}
          size={"small"}
          icon={<HolderOutlined />}
          aria-label={`Move ${category.name}`}
          style={{
            cursor: "grab",
            width: STEP,
            minWidth: STEP,
            padding: 0,
            flexShrink: 0,
          }}
          {...sortable.attributes}
          {...sortable.listeners}
        />
        <Caret
          open={!collapsed}
          label={`${collapsed ? "Show" : "Hide"} ${category.name}`}
          onClick={onCollapse}
        />
        <span
          style={{
            width: STEP,
            display: "flex",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <CategoryIcon icon={category.icon} color={category.color} />
        </span>
        <Text strong={true} ellipsis={true} style={{ flex: 1, minWidth: 0 }}>
          {category.name}
        </Text>
        {collapsed && (
          <Text type={"secondary"} style={{ fontSize: 12, marginInline: 4 }}>
            {goals.length}
          </Text>
        )}
      </Flex>
      {!collapsed &&
        goalTree(goals, 99).map(({ goal, depth }) => {
          // Past the heading's handle and caret: a goal's caret sits under
          // the category's icon, its title under the name.
          const indent = 2 * STEP + depth * STEP;
          const isOpen = open.has(goal.id);
          return (
            <React.Fragment key={goal.id}>
              <Flex style={{ height: ROW }} align={"center"}>
                <Flex
                  align={"center"}
                  style={{
                    width: label,
                    flexShrink: 0,
                    paddingLeft: indent,
                    paddingRight: 8,
                    minWidth: 0,
                  }}
                >
                  {hasMilestones(goal) ? (
                    <Caret
                      open={isOpen}
                      label={`${isOpen ? "Hide" : "Show"} ${goal.title}'s milestones`}
                      onClick={() => onToggleGoal(goal)}
                    />
                  ) : (
                    <span style={{ width: STEP, flexShrink: 0 }} />
                  )}
                  <Link
                    href={`/minerva/goals/${goal.id}`}
                    style={{ minWidth: 0 }}
                  >
                    <Text
                      ellipsis={{ tooltip: goal.title }}
                      style={{ fontSize: 13 }}
                    >
                      {goal.title}
                    </Text>
                  </Link>
                </Flex>
                <div style={{ position: "relative", flex: 1, height: "100%" }}>
                  <GoalMark goal={goal} year={year} today={today} />
                </div>
              </Flex>
              {isOpen &&
                (milestones.get(goal.id) ?? []).map((m) => (
                  <Flex key={m.id} style={{ height: ROW - 6 }} align={"center"}>
                    <div
                      style={{
                        width: label,
                        flexShrink: 0,
                        paddingLeft: indent + STEP,
                        paddingRight: 8,
                        minWidth: 0,
                      }}
                    >
                      <Text
                        type={"secondary"}
                        delete={m.done}
                        ellipsis={{ tooltip: m.title }}
                        style={{ fontSize: 12 }}
                      >
                        {m.title}
                      </Text>
                    </div>
                    <div
                      style={{ position: "relative", flex: 1, height: "100%" }}
                    >
                      <MilestoneMark milestone={m} year={year} today={today} />
                    </div>
                  </Flex>
                ))}
              {isOpen && milestones.get(goal.id)?.length === 0 && (
                <Text
                  type={"secondary"}
                  style={{ fontSize: 12, paddingLeft: indent + STEP }}
                >
                  No milestones
                </Text>
              )}
            </React.Fragment>
          );
        })}
    </div>
  );
};

/**
 * The Roadmap: a year as a timeline, quarters and 12-week cycles side by
 * side (the buffer hatched), a lane per category with sub-goals indented
 * under their parents, a milestone goal's steps a click away, and a today
 * line.
 */
const RoadmapView: React.FunctionComponent<RoadmapViewProps> = ({
  goals,
  categories,
  cycles,
  today,
  year,
  onReorder,
}) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState(categories);
  useEffect(() => setOrder(categories), [categories]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  // The roadmap fills the window below where it starts, so only its lanes
  // scroll and the header above them holds still.
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const fit = () => {
      const top = rootRef.current?.getBoundingClientRect().top;
      if (top !== undefined) {
        setHeight(Math.max(320, window.innerHeight - top - 16));
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  // The goal column's width: dragged from the divider on its right, or
  // nudged with the arrow keys once it has focus; remembered in this
  // browser.
  const [label, setLabel] = useState(LABEL);
  const [resizing, setResizing] = useState(false);
  const [hover, setHover] = useState(false);
  const lit = resizing || hover;
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(LABEL_KEY));
      if (saved) setLabel(clampLabel(saved));
    } catch {
      // No storage: the default width stands.
    }
  }, []);
  const keepLabel = (width: number) => {
    const next = clampLabel(width);
    setLabel(next);
    try {
      window.localStorage.setItem(LABEL_KEY, String(next));
    } catch {
      // Not remembered; the width still applies here.
    }
  };
  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = label;
    setResizing(true);
    const move = (e: PointerEvent) =>
      setLabel(clampLabel(startWidth + e.clientX - startX));
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setResizing(false);
      keepLabel(startWidth + e.clientX - startX);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const [milestones, setMilestones] = useState<Map<string, GoalMilestone[]>>(
    new Map(),
  );
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const lanes = byCategory(
    goals.filter((g) => roadmapMark(g, year)),
    order,
  ).filter((l) => l.goals.length > 0);

  // Lanes move aside as one is dragged; the new order is saved on drop, for
  // the categories everywhere. Categories with no lane keep their places.
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
  const todayAt =
    today >= from && today <= to ? spanFraction(today, from, to) : undefined;
  const months = Array.from({ length: 12 }, (_, m) =>
    DateTime.fromObject({ year, month: m + 1, day: 1 }),
  );

  const toggle = async (goal: Goal) => {
    const next = new Set(open);
    if (next.has(goal.id)) {
      next.delete(goal.id);
      setOpen(next);
      return;
    }
    next.add(goal.id);
    setOpen(next);
    if (!milestones.has(goal.id)) {
      try {
        const full = await goalsApi.describeGoal(goal.id);
        setMilestones((was) => new Map(was).set(goal.id, full.milestones));
      } catch {
        setMilestones((was) => new Map(was).set(goal.id, []));
      }
    }
  };

  return (
    <LabelWidth.Provider value={label}>
      <div
        ref={rootRef}
        style={{
          minWidth: 900,
          height,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          userSelect: resizing ? "none" : undefined,
          cursor: resizing ? "col-resize" : undefined,
        }}
      >
        {/* A line where each month starts, from the bands to the bottom,
            behind the bars; the months keep their share of the timeline
            whatever the goal column's width. */}
        {months.slice(1).map((m) => (
          <div
            key={m.month}
            aria-hidden={true}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `calc(${label}px + (100% - ${label}px) * ${spanFraction(m.toISODate()!, from, to)})`,
              borderLeft: "1px solid #f0f0f0",
              pointerEvents: "none",
            }}
          />
        ))}
        {/* The goal column's right border, which drags to resize it. */}
        <div
          role={"separator"}
          aria-orientation={"vertical"}
          aria-label={"Resize the goal column"}
          aria-valuenow={label}
          aria-valuemin={LABEL_MIN}
          aria-valuemax={LABEL_MAX}
          tabIndex={0}
          onPointerDown={startResize}
          onDoubleClick={() => keepLabel(LABEL)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") keepLabel(label - 16);
            else if (e.key === "ArrowRight") keepLabel(label + 16);
          }}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: label - 4,
            width: 9,
            zIndex: 3,
            cursor: "col-resize",
            display: "flex",
            justifyContent: "center",
            outline: "none",
          }}
        >
          <div
            style={{
              width: lit ? 2 : 1,
              background: lit ? "#1677ff" : "#f0f0f0",
            }}
          />
        </div>
        {/* The bands and months hold still; only the lanes below them
          scroll. */}
        <div style={{ flexShrink: 0 }}>
          <BandRow title={"Quarters"} bands={quarterBands(year)} />
          <BandRow title={"12-week cycles"} bands={cycleBands(cycles, year)} />
          <Flex style={{ height: 22, borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ width: label, flexShrink: 0 }} />
            <div style={{ position: "relative", flex: 1 }}>
              {months.map((m) => (
                <Text
                  key={m.month}
                  type={"secondary"}
                  style={{
                    position: "absolute",
                    left: pct(spanFraction(m.toISODate()!, from, to)),
                    fontSize: 12,
                    paddingLeft: 4,
                  }}
                >
                  {m.toFormat("LLL")}
                </Text>
              ))}
              {todayAt !== undefined && (
                <Text
                  style={{
                    position: "absolute",
                    left: pct(todayAt),
                    bottom: 0,
                    transform: "translateX(-50%)",
                    paddingInline: 4,
                    fontSize: 11,
                    lineHeight: "16px",
                    color: "#ff4d4f",
                    background: "#ffffff",
                    borderBottom: "2px solid #ff4d4f",
                    whiteSpace: "nowrap",
                  }}
                >
                  {DateTime.fromISO(today).toFormat("LLL d")}
                </Text>
              )}
            </div>
          </Flex>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarGutter: "stable",
          }}
        >
          <div style={{ position: "relative" }}>
            {lanes.length === 0 && (
              <Empty description={`No goals in ${year}`} />
            )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={dragEnd}
            >
              <SortableContext
                items={lanes.map((l) => l.category.id)}
                strategy={verticalListSortingStrategy}
              >
                {lanes.map(({ category, goals: inLane }) => (
                  <Lane
                    key={category.id}
                    category={category}
                    goals={inLane}
                    year={year}
                    today={today}
                    collapsed={collapsed.has(category.id)}
                    onCollapse={() =>
                      setCollapsed((was) => {
                        const next = new Set(was);
                        if (next.has(category.id)) next.delete(category.id);
                        else next.add(category.id);
                        return next;
                      })
                    }
                    open={open}
                    milestones={milestones}
                    onToggleGoal={toggle}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {todayAt !== undefined && (
              <div
                aria-hidden={true}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `calc(${label}px + (100% - ${label}px) * ${todayAt})`,
                  borderLeft: "2px solid #ff4d4f",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        </div>
      </div>
    </LabelWidth.Provider>
  );
};

export default RoadmapView;
