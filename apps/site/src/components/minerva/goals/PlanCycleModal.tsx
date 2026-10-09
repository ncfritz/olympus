import type { GoalCycle } from "@ncfritz/olympus-sdk/minerva";
import { Alert, message, Modal, Typography } from "antd";
import React, { useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import {
  apiProblems,
  cycleSpanText,
  nextCycleDefaults,
} from "../../../utils/goals";
import CycleFields, { type CycleValues } from "./CycleFields";

const { Text } = Typography;

/**
 * Plan the next cycle from Focus: filled in from the latest cycle (the next
 * name, the Monday after its buffer, the same length), one step to create.
 */
const PlanCycleModal: React.FunctionComponent<{
  open: boolean;
  cycles: GoalCycle[];
  today: string;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, cycles, today, onClose, onCreated }) => {
  const [value, setValue] = useState<CycleValues>(
    nextCycleDefaults(cycles, today),
  );
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const latest = [...cycles].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  )[0];

  useEffect(() => {
    if (open) {
      setValue(nextCycleDefaults(cycles, today));
      setProblem(undefined);
    }
  }, [open, cycles, today]);

  const create = async () => {
    setSaving(true);
    setProblem(undefined);
    try {
      await goalsApi.createCycle({ ...value, name: value.name.trim() });
      message.success(`${value.name.trim()} planned`);
      onCreated();
    } catch (error) {
      setProblem(apiProblems(error).join(" "));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={latest ? "Plan the next cycle" : "Plan a cycle"}
      okText={"Create cycle"}
      okButtonProps={{ disabled: !value.name.trim() }}
      confirmLoading={saving}
      onOk={create}
      onCancel={onClose}
      destroyOnHidden={true}
    >
      <Text type={"secondary"}>
        {latest
          ? `Filled in from ${latest.name}: the next name, the Monday after its buffer, the same length.`
          : "Twelve weeks and a buffer week, from the next Monday."}
      </Text>
      <div style={{ marginBlock: 16 }}>
        <CycleFields
          value={value}
          onChange={(v) => {
            setValue(v);
            setProblem(undefined);
          }}
          size={"middle"}
          error={problem !== undefined}
          label={"New cycle"}
        />
      </div>
      {problem ? (
        <Alert type={"error"} showIcon={true} title={problem} />
      ) : (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 6,
            background: "#f5f5f5",
            fontSize: 13,
          }}
        >
          Runs{" "}
          {cycleSpanText(
            value.startDate,
            value.weeks,
            value.bufferWeeks,
            today,
          )}
        </div>
      )}
    </Modal>
  );
};

export default PlanCycleModal;
