import type {
  Goal,
  GoalCheckinSuggestion,
  GoalHealth,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Skeleton,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import React, { useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import { apiProblems, formatValue, HEALTH } from "../../../utils/goals";

const { Text } = Typography;

type CheckinShape = {
  checkinDate: Dayjs;
  value?: number;
  confidence?: GoalHealth;
  note?: string;
};

export interface CheckinFormProps {
  goal: Goal;
  /** A check-in was saved; the caller reloads what shows it. */
  onSaved: () => void;
  /** Where the form is: the goal page, or a review panel later. */
  source?: "goal" | "daily_review" | "weekly_review";
}

/**
 * A check-in: an outcome's value, a confidence with the one pace suggests
 * picked to start with, and a note. Today by default; a past day can be
 * backfilled, a future one cannot.
 */
const CheckinForm: React.FunctionComponent<CheckinFormProps> = ({
  goal,
  onSaved,
  source = "goal",
}) => {
  const [form] = Form.useForm<CheckinShape>();
  const [suggestion, setSuggestion] = useState<GoalCheckinSuggestion>();
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const outcome = goal.type === "outcome";

  useEffect(() => {
    let live = true;
    goalsApi
      .suggestCheckin(goal.id)
      .then((s) => {
        if (!live) return;
        setSuggestion(s);
        form.setFieldsValue({
          checkinDate: dayjs(s.checkinDate),
          value: outcome ? s.currentValue : undefined,
          confidence: s.confidence,
        });
      })
      .catch(() => live && setSuggestion(undefined));
    return () => {
      live = false;
    };
  }, [goal.id, outcome, form]);

  const save = async (values: CheckinShape) => {
    setSaving(true);
    setProblems([]);
    try {
      await goalsApi.createCheckin(goal.id, {
        checkinDate: values.checkinDate.format("YYYY-MM-DD"),
        value: outcome ? values.value : undefined,
        confidence: values.confidence,
        note: values.note?.trim() || undefined,
        source,
      });
      message.success("Checked in");
      form.setFieldsValue({ note: undefined });
      onSaved();
    } catch (error) {
      setProblems(apiProblems(error));
    } finally {
      setSaving(false);
    }
  };

  if (!suggestion) return <Skeleton active={true} />;

  const today = dayjs(suggestion.checkinDate);

  return (
    <Form form={form} layout={"vertical"} onFinish={save}>
      {problems.length > 0 && (
        <Alert
          type={"error"}
          showIcon={true}
          style={{ marginBottom: 12 }}
          title={problems.join(" ")}
        />
      )}
      <Form.Item
        name={"checkinDate"}
        label={"Day"}
        rules={[{ required: true }]}
      >
        <DatePicker
          style={{ width: "100%" }}
          allowClear={false}
          disabledDate={(d) => d.isAfter(today, "day")}
        />
      </Form.Item>
      {outcome && (
        <Form.Item
          name={"value"}
          label={`${goal.unit ? `${goal.unit[0].toUpperCase()}${goal.unit.slice(1)}` : "Value"} so far`}
          rules={[{ required: true }]}
          extra={
            suggestion.expectedValue !== undefined
              ? `Pace says ${formatValue(suggestion.expectedValue)} today.`
              : undefined
          }
        >
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>
      )}
      <Form.Item
        name={"confidence"}
        label={
          <span>
            Confidence{" "}
            <Text type={"secondary"}>
              · suggested: {HEALTH[suggestion.confidence].label.toLowerCase()}
            </Text>
          </span>
        }
        rules={[{ required: !outcome }]}
      >
        <Radio.Group
          optionType={"button"}
          buttonStyle={"solid"}
          options={(["on_track", "at_risk", "off_track"] as const).map((h) => ({
            value: h,
            label: HEALTH[h].label,
          }))}
        />
      </Form.Item>
      <Form.Item name={"note"} label={"Note"} rules={[{ max: 2000 }]}>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 6 }}
          maxLength={2000}
        />
      </Form.Item>
      <Button
        type={"primary"}
        htmlType={"submit"}
        loading={saving}
        block={true}
      >
        Save check-in
      </Button>
    </Form>
  );
};

export default CheckinForm;
