import {
  DeleteOutlined,
  PlusOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { Goal, GoalCycle } from "@ncfritz/olympus-sdk/minerva";
import {
  Button,
  Drawer,
  Empty,
  Flex,
  message,
  Popconfirm,
  Space,
  Typography,
} from "antd";
import React, { useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import {
  apiProblems,
  cycleSpanText,
  nextCycleDefaults,
} from "../../../utils/goals";
import CycleFields, { type CycleValues } from "./CycleFields";

const { Text } = Typography;

const CAPS: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#595959",
};

const EDGE = {
  current: "#0958d9",
  buffer: "#0958d9",
  upcoming: "#52c41a",
  past: "#bfbfbf",
};

const valuesOf = (c: GoalCycle): CycleValues => ({
  name: c.name,
  startDate: c.startDate,
  weeks: c.weeks,
  bufferWeeks: c.bufferWeeks,
});

const statusText = (c: GoalCycle, today: string) => {
  const span = cycleSpanText(c.startDate, c.weeks, c.bufferWeeks, today);
  if (c.status === "current" && c.currentWeek !== undefined) {
    return `Week ${c.currentWeek} of ${c.weeks} · ${span}`;
  }
  if (c.status === "buffer") return `Buffer week · ${span}`;
  return span;
};

/** One cycle, edited in place: each change saves as its field is left. */
const CycleRow: React.FunctionComponent<{
  cycle: GoalCycle;
  goalCount: number;
  today: string;
  onChanged: () => Promise<void>;
}> = ({ cycle, goalCount, today, onChanged }) => {
  const [value, setValue] = useState(valuesOf(cycle));
  useEffect(() => setValue(valuesOf(cycle)), [cycle]);

  const save = async (next: CycleValues) => {
    const changes: Partial<CycleValues> = {};
    const was = valuesOf(cycle);
    (Object.keys(next) as (keyof CycleValues)[]).forEach((k) => {
      if (next[k] !== was[k]) (changes as Record<string, unknown>)[k] = next[k];
    });
    if (Object.keys(changes).length === 0) return;
    if (changes.name !== undefined && !changes.name.trim()) {
      setValue(was);
      return;
    }
    try {
      await goalsApi.updateCycle(cycle.id, changes);
      await onChanged();
    } catch (error) {
      message.error(apiProblems(error).join(" "));
      setValue(was);
    }
  };

  return (
    <Flex
      vertical={true}
      gap={8}
      style={{
        padding: 12,
        background: "#ffffff",
        border: "1px solid #f0f0f0",
        borderLeft: `5px solid ${EDGE[cycle.status]}`,
        borderRadius: 4,
      }}
    >
      <CycleFields
        value={value}
        onChange={setValue}
        onCommit={save}
        label={cycle.name}
      />
      <Flex justify={"space-between"} align={"center"}>
        <Text style={{ fontSize: 12, color: "#595959" }}>
          {statusText(cycle, today)}
        </Text>
        <Space size={12}>
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            {goalCount} goal{goalCount === 1 ? "" : "s"}
          </Text>
          <Popconfirm
            title={`Delete ${cycle.name}?`}
            description={
              goalCount > 0
                ? `Its ${goalCount} goal${goalCount === 1 ? "" : "s"} keep their dates and become custom-horizon goals.`
                : undefined
            }
            okText={"Delete"}
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await goalsApi.deleteCycle(cycle.id);
                await onChanged();
              } catch (error) {
                message.error(apiProblems(error).join(" "));
              }
            }}
          >
            <Button
              type={"text"}
              size={"small"}
              danger={true}
              icon={<DeleteOutlined />}
              aria-label={`Delete ${cycle.name}`}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      </Flex>
    </Flex>
  );
};

/**
 * Manage cycles (design canvas, Cycles row): add a cycle at the top, the
 * next one filled in; below, Current, Upcoming and Past, each edited in
 * place and deletable.
 */
const CyclesDrawer: React.FunctionComponent<{
  open: boolean;
  cycles: GoalCycle[];
  goals: Goal[];
  today: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}> = ({ open, cycles, goals, today, onClose, onChanged }) => {
  const [adding, setAdding] = useState<CycleValues>(
    nextCycleDefaults(cycles, today),
  );
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAdding(nextCycleDefaults(cycles, today));
      setProblem(undefined);
    }
  }, [open, cycles, today]);

  const add = async () => {
    setSaving(true);
    setProblem(undefined);
    try {
      await goalsApi.createCycle({ ...adding, name: adding.name.trim() });
      await onChanged();
    } catch (error) {
      setProblem(apiProblems(error).join(" "));
    } finally {
      setSaving(false);
    }
  };

  const count = (c: GoalCycle) =>
    goals.filter((g) => g.cycleId === c.id).length;
  const groups: { title: string; cycles: GoalCycle[]; empty: string }[] = [
    {
      title: "Current",
      cycles: cycles.filter(
        (c) => c.status === "current" || c.status === "buffer",
      ),
      empty: "No cycle is running.",
    },
    {
      title: "Upcoming",
      cycles: cycles
        .filter((c) => c.status === "upcoming")
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      empty: "None planned yet.",
    },
    {
      title: "Past",
      cycles: cycles.filter((c) => c.status === "past"),
      empty: "None yet.",
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={"Manage cycles"}
      size={520}
      styles={{ body: { background: "#fafafa" } }}
    >
      {/* Stays at the top while the cycles scroll beneath it. */}
      <div
        style={{
          position: "sticky",
          top: -24,
          zIndex: 2,
          background: "#ffffff",
          margin: "-24px -24px 16px",
          padding: "16px 24px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span style={CAPS}>Add a cycle</span>
        <Flex gap={8} align={"flex-end"} wrap={true}>
          <CycleFields
            value={adding}
            onChange={(v) => {
              setAdding(v);
              setProblem(undefined);
            }}
            error={problem !== undefined}
            label={"New cycle"}
          />
          <Button
            type={"primary"}
            size={"small"}
            icon={<PlusOutlined />}
            loading={saving}
            disabled={!adding.name.trim()}
            onClick={add}
          >
            Add
          </Button>
        </Flex>
        {problem ? (
          <Text type={"danger"} style={{ fontSize: 12 }}>
            <WarningOutlined /> {problem}
          </Text>
        ) : (
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            {cycleSpanText(
              adding.startDate,
              adding.weeks,
              adding.bufferWeeks,
              today,
            )}
          </Text>
        )}
      </div>
      <Flex vertical={true} gap={10}>
        {groups.map((group) => (
          <Flex
            key={group.title}
            vertical={true}
            gap={10}
            style={{ marginBottom: 8 }}
          >
            <span style={CAPS}>{group.title}</span>
            {group.cycles.length === 0 ? (
              <Text type={"secondary"} style={{ fontSize: 13 }}>
                {group.empty}
              </Text>
            ) : (
              group.cycles.map((c) => (
                <CycleRow
                  key={c.id}
                  cycle={c}
                  goalCount={count(c)}
                  today={today}
                  onChanged={onChanged}
                />
              ))
            )}
          </Flex>
        ))}
        {cycles.length === 0 && (
          <Empty description={"Plan in 12-week cycles: add the first above."} />
        )}
      </Flex>
    </Drawer>
  );
};

export default CyclesDrawer;
