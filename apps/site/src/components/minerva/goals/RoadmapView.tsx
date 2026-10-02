import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type {
  Goal,
  GoalCategory,
  GoalCycle,
} from "@ncfritz/olympus-sdk/minerva";
import { Button, Card, Empty, Flex, Space, Tooltip, Typography } from "antd";
import { DateTime } from "luxon";
import Link from "next/link";
import React, { useState } from "react";
import {
  type Band,
  byCategory,
  cycleBands,
  dueText,
  HEALTH,
  metricText,
  quarterBands,
  roadmapMark,
  spanFraction,
} from "../../../utils/goals";
import { CategoryIcon } from "./GoalBits";

const { Text } = Typography;

const LABEL = 240;
const ROW = 30;

const HEALTH_COLOR = {
  on_track: "#52c41a",
  at_risk: "#faad14",
  off_track: "#ff4d4f",
} as const;

const pct = (f: number) => `${f * 100}%`;

/** A row of labelled bands across the year: quarters, or cycles with their buffer. */
const BandRow: React.FunctionComponent<{ title: string; bands: Band[] }> = ({
  title,
  bands,
}) => (
  <Flex style={{ height: 24 }}>
    <Text type={"secondary"} style={{ width: LABEL, fontSize: 12 }}>
      {title}
    </Text>
    <div style={{ position: "relative", flex: 1 }}>
      {bands.map((b) => (
        <React.Fragment key={b.label}>
          <div
            style={{
              position: "absolute",
              left: pct(b.from),
              width: pct(b.to - b.from),
              top: 2,
              bottom: 2,
              background: "#f0f5ff",
              border: "1px solid #d6e4ff",
              borderRadius: 4,
              fontSize: 12,
              paddingInline: 6,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {b.label}
          </div>
          {b.buffer !== undefined && b.buffer > b.to && (
            <Tooltip title={`${b.label} buffer`}>
              <div
                aria-label={`${b.label} buffer`}
                style={{
                  position: "absolute",
                  left: pct(b.to),
                  width: pct(b.buffer - b.to),
                  top: 2,
                  bottom: 2,
                  background:
                    "repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 3px, #fff 3px, #fff 6px)",
                  border: "1px solid #d9d9d9",
                  borderRadius: 4,
                }}
              />
            </Tooltip>
          )}
        </React.Fragment>
      ))}
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
}

/**
 * The Roadmap: a year as a timeline, quarters and 12-week cycles side by
 * side (the buffer hatched), a lane per category, and a today line.
 */
const RoadmapView: React.FunctionComponent<RoadmapViewProps> = ({
  goals,
  categories,
  cycles,
  today,
}) => {
  const [year, setYear] = useState(DateTime.fromISO(today).year);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const lanes = byCategory(
    goals.filter((g) => roadmapMark(g, year)),
    categories,
  ).filter((l) => l.goals.length > 0);
  const todayAt =
    today >= from && today <= to ? spanFraction(today, from, to) : undefined;
  const months = Array.from({ length: 12 }, (_, m) =>
    DateTime.fromObject({ year, month: m + 1, day: 1 }),
  );

  return (
    <Card
      size={"small"}
      title={
        <Space>
          <Button
            type={"text"}
            size={"small"}
            icon={<LeftOutlined />}
            aria-label={"Previous year"}
            onClick={() => setYear((y) => y - 1)}
          />
          <span>{year} roadmap</span>
          <Button
            type={"text"}
            size={"small"}
            icon={<RightOutlined />}
            aria-label={"Next year"}
            onClick={() => setYear((y) => y + 1)}
          />
        </Space>
      }
    >
      <div style={{ position: "relative", minWidth: 900 }}>
        <BandRow title={"Quarters"} bands={quarterBands(year)} />
        <BandRow title={"12-week cycles"} bands={cycleBands(cycles, year)} />
        <Flex style={{ height: 22, borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ width: LABEL }} />
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
                  borderLeft: "1px solid #f0f0f0",
                }}
              >
                {m.toFormat("LLL")}
              </Text>
            ))}
          </div>
        </Flex>
        {lanes.length === 0 && <Empty description={`No goals in ${year}`} />}
        {lanes.map(({ category, goals: inLane }) => (
          <div
            key={category.id}
            style={{ borderBottom: "1px solid #f0f0f0", paddingBlock: 4 }}
          >
            <Space style={{ height: 24 }}>
              <CategoryIcon icon={category.icon} color={category.color} />
              <Text strong={true}>{category.name}</Text>
            </Space>
            {inLane.map((goal) => (
              <Flex key={goal.id} style={{ height: ROW }} align={"center"}>
                <div
                  style={{
                    width: LABEL,
                    paddingLeft: 22,
                    paddingRight: 8,
                    minWidth: 0,
                  }}
                >
                  <Link href={`/minerva/goals/${goal.id}`}>
                    <Text
                      ellipsis={{ tooltip: goal.title }}
                      style={{ fontSize: 13 }}
                    >
                      {goal.title}
                    </Text>
                  </Link>
                </div>
                <div style={{ position: "relative", flex: 1, height: "100%" }}>
                  <GoalMark goal={goal} year={year} today={today} />
                </div>
              </Flex>
            ))}
          </div>
        ))}
        {todayAt !== undefined && (
          <div
            aria-hidden={true}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `calc(${LABEL}px + (100% - ${LABEL}px) * ${todayAt})`,
              borderLeft: "2px solid #ff4d4f",
              pointerEvents: "none",
            }}
          >
            <Text
              style={{
                position: "absolute",
                top: -18,
                left: -20,
                fontSize: 11,
                color: "#ff4d4f",
                whiteSpace: "nowrap",
              }}
            >
              {DateTime.fromISO(today).toFormat("LLL d")}
            </Text>
          </div>
        )}
      </div>
      <Flex gap={24} wrap={true} style={{ marginTop: 12 }}>
        <Text type={"secondary"} style={{ fontSize: 12 }}>
          ▭ Start to due date, filled to progress
        </Text>
        <Text type={"secondary"} style={{ fontSize: 12 }}>
          ┄ Ongoing habit
        </Text>
        <Text type={"secondary"} style={{ fontSize: 12 }}>
          ◇ Achievement date
        </Text>
        <Text type={"secondary"} style={{ fontSize: 12 }}>
          ▨ Cycle buffer week
        </Text>
      </Flex>
    </Card>
  );
};

export default RoadmapView;
