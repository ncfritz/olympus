import type { Goal, GoalStatus } from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import React, { useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import { apiProblems, STATUS_LABEL } from "../../../utils/goals";

type CloseShape = {
  status: GoalStatus;
  closedOn: Dayjs;
  finalValue?: number;
  finalProgress?: number;
  note?: string;
};

/**
 * The close-out: how the goal ended (Achieved, Missed or Dropped), the
 * day, an outcome's final value or a hand-set goal's final progress, and
 * what was learned.
 */
const CloseGoalModal: React.FunctionComponent<{
  goal?: Goal;
  /** The status to start from, e.g. Dropped from a decision banner. */
  status?: "achieved" | "missed" | "dropped";
  onClose: () => void;
  onClosed: () => void;
}> = ({ goal, status = "achieved", onClose, onClosed }) => {
  const [form] = Form.useForm<CloseShape>();
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    if (goal) {
      form.setFieldsValue({
        status,
        closedOn: dayjs(),
        finalValue: goal.type === "outcome" ? goal.currentValue : undefined,
        finalProgress:
          goal.progressMode === "manual" ? goal.progress : undefined,
        note: undefined,
      });
      setProblems([]);
    }
  }, [goal, status, form]);

  const save = async () => {
    if (!goal) return;
    let values: CloseShape;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      await goalsApi.closeGoal(goal.id, {
        status: values.status,
        closedOn: values.closedOn.format("YYYY-MM-DD"),
        finalValue: values.finalValue,
        finalProgress: values.finalProgress,
        note: values.note?.trim() || undefined,
      });
      message.success(`${goal.title}: ${STATUS_LABEL[values.status]}`);
      onClosed();
    } catch (error) {
      setProblems(apiProblems(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={goal !== undefined}
      title={goal ? `Close out · ${goal.title}` : undefined}
      okText={"Close goal"}
      confirmLoading={saving}
      onOk={save}
      onCancel={onClose}
      destroyOnHidden={true}
    >
      {problems.length > 0 && (
        <Alert
          type={"error"}
          showIcon={true}
          style={{ marginBottom: 12 }}
          title={problems.join(" ")}
        />
      )}
      <Form form={form} layout={"vertical"}>
        <Form.Item name={"status"} label={"How it ended"}>
          <Radio.Group
            optionType={"button"}
            options={(["achieved", "missed", "dropped"] as const).map((s) => ({
              value: s,
              label: STATUS_LABEL[s],
            }))}
          />
        </Form.Item>
        <Form.Item name={"closedOn"} label={"Day"} rules={[{ required: true }]}>
          <DatePicker
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs(), "day")}
          />
        </Form.Item>
        {goal?.type === "outcome" && (
          <Form.Item
            name={"finalValue"}
            label={`Final value${goal.unit ? ` (${goal.unit})` : ""}`}
            extra={"Recorded as a check-in on the closing day."}
          >
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
        )}
        {goal?.progressMode === "manual" && (
          <Form.Item name={"finalProgress"} label={"Final progress (%)"}>
            <InputNumber min={0} max={100} precision={0} />
          </Form.Item>
        )}
        <Form.Item
          name={"note"}
          label={"What I learned"}
          rules={[{ max: 2000 }]}
        >
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 8 }}
            maxLength={2000}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CloseGoalModal;
