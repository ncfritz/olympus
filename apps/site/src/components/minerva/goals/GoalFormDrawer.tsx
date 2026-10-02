import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type {
  FullGoal,
  Goal,
  GoalCategory,
  GoalCycle,
  GoalType,
  Tag,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Segmented,
  Select,
  Space,
  TreeSelect,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import React, { useEffect, useMemo, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import {
  apiProblems,
  emptyGoalForm,
  FREQUENCY_LABEL,
  formToCreate,
  formToUpdate,
  type GoalFormValues,
  goalToForm,
  goalTree,
  HORIZON_LABEL,
  MODE_LABEL,
  MODES,
  ROLLUP_LABEL,
  TYPE_LABEL,
} from "../../../utils/goals";
import { GoalTypeIcon } from "./GoalBits";
import TagPicker from "./TagPicker";

/** The form as AntD holds it: dates as Dayjs. */
type FormShape = Omit<
  GoalFormValues,
  "startDate" | "dueDate" | "milestones"
> & {
  startDate?: Dayjs;
  dueDate?: Dayjs;
  milestones: { title: string; dueDate?: Dayjs }[];
};

const toShape = (v: GoalFormValues): FormShape => ({
  ...v,
  startDate: v.startDate ? dayjs(v.startDate) : undefined,
  dueDate: v.dueDate ? dayjs(v.dueDate) : undefined,
  milestones: v.milestones.map((m) => ({
    title: m.title,
    dueDate: m.dueDate ? dayjs(m.dueDate) : undefined,
  })),
});

const day = (d?: Dayjs | null) => (d ? d.format("YYYY-MM-DD") : undefined);

const fromShape = (s: FormShape): GoalFormValues => ({
  ...s,
  startDate: day(s.startDate),
  dueDate: day(s.dueDate),
  milestones: (s.milestones ?? []).map((m) => ({
    title: m.title ?? "",
    dueDate: day(m.dueDate),
  })),
  tagIds: s.tagIds ?? [],
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
  (label, i) => ({ label, value: i + 1 }),
);

export interface GoalFormDrawerProps {
  open: boolean;
  /** The goal to edit; a new goal when absent. */
  goal?: FullGoal;
  /** A new goal's category and parent, when the caller knows them. */
  categoryId?: string;
  parentId?: string;
  categories: GoalCategory[];
  cycles: GoalCycle[];
  /** The caller's goals, for the parent picker. */
  goals: Goal[];
  tags: Tag[];
  onTagCreated?: (tag: Tag) => void;
  onClose: () => void;
  onSaved: (goal: FullGoal) => void;
}

/**
 * New and edit goal (design.md, decided: one adaptive form). The type
 * comes first and the fields under it follow: an outcome's start and
 * target, a habit's rule, a milestone goal's steps. A goal's type is fixed
 * once created.
 */
const GoalFormDrawer: React.FunctionComponent<GoalFormDrawerProps> = ({
  open,
  goal,
  categoryId,
  parentId,
  categories,
  cycles,
  goals,
  tags,
  onTagCreated,
  onClose,
  onSaved,
}) => {
  const [form] = Form.useForm<FormShape>();
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const editing = goal !== undefined;
  const initial = useMemo(
    () => (goal ? goalToForm(goal) : emptyGoalForm(categoryId, parentId)),
    [goal, categoryId, parentId],
  );

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(toShape(initial));
      setProblems([]);
    }
  }, [open, initial, form]);

  const type = Form.useWatch("type", form) ?? initial.type;
  const horizon = Form.useWatch("horizon", form) ?? initial.horizon;
  const mode = Form.useWatch("progressMode", form) ?? initial.progressMode;
  const frequency = Form.useWatch("frequency", form);
  const quantityTarget = Form.useWatch("quantityTarget", form);

  const parents = useMemo(() => {
    const rows = goalTree(
      goals.filter((g) => g.id !== goal?.id),
      99,
    );
    return rows.map((r) => ({
      value: r.goal.id,
      title: `${"  ".repeat(r.depth)}${r.goal.title}`,
    }));
  }, [goals, goal]);

  const setType = (next: GoalType) => {
    form.setFieldsValue({
      type: next,
      progressMode: MODES[next][0],
      horizon: next === "habit" ? "ongoing" : form.getFieldValue("horizon"),
      frequency: next === "habit" ? (frequency ?? "daily") : undefined,
    });
  };

  const save = async () => {
    let shape: FormShape;
    try {
      shape = await form.validateFields();
    } catch {
      return;
    }
    const values = fromShape({ ...form.getFieldsValue(true), ...shape });
    setSaving(true);
    setProblems([]);
    try {
      const saved = editing
        ? await goalsApi.updateGoal(goal.id, formToUpdate(initial, values))
        : await goalsApi.createGoal(formToCreate(values));
      message.success(editing ? "Goal saved" : "Goal created");
      onSaved(saved ?? goal!);
    } catch (error) {
      setProblems(apiProblems(error));
    } finally {
      setSaving(false);
    }
  };

  const activeCycles = cycles.filter(
    (c) => c.status !== "past" || c.id === initial.cycleId,
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={560}
      title={editing ? `Edit ${goal.title}` : "New goal"}
      destroyOnHidden={true}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type={"primary"} loading={saving} onClick={save}>
            {editing ? "Save" : "Create goal"}
          </Button>
        </Space>
      }
    >
      {problems.length > 0 && (
        <Alert
          type={"error"}
          showIcon={true}
          style={{ marginBottom: 16 }}
          title={"The goal was not saved"}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          }
        />
      )}
      <Form form={form} layout={"vertical"} requiredMark={"optional"}>
        <Form.Item name={"type"} label={"Type"} required={true}>
          <Segmented
            block={true}
            disabled={editing}
            onChange={(v) => setType(v as GoalType)}
            options={(Object.keys(TYPE_LABEL) as GoalType[]).map((t) => ({
              value: t,
              label: (
                <Space size={6}>
                  <GoalTypeIcon type={t} />
                  {TYPE_LABEL[t]}
                </Space>
              ),
            }))}
          />
        </Form.Item>
        <Form.Item
          name={"title"}
          label={"Title"}
          rules={[{ required: true, whitespace: true, max: 120 }]}
        >
          <Input placeholder={"Read 24 books"} maxLength={120} />
        </Form.Item>
        <Form.Item name={"why"} label={"Why"} rules={[{ max: 500 }]}>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={500}
            placeholder={"What reaching it will change"}
          />
        </Form.Item>
        <Flex gap={16}>
          <Form.Item
            name={"categoryId"}
            label={"Category"}
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <Select
              options={categories
                .filter((c) => !c.archived || c.id === initial.categoryId)
                .map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name={"parentId"} label={"Under goal"} style={{ flex: 1 }}>
            <TreeSelect
              allowClear={true}
              showSearch={true}
              treeNodeFilterProp={"title"}
              placeholder={"Top level"}
              treeData={parents}
            />
          </Form.Item>
        </Flex>

        <Divider titlePlacement={"start"}>When</Divider>
        <Form.Item name={"horizon"} label={"Horizon"} required={true}>
          <Radio.Group
            optionType={"button"}
            options={(
              ["year", "quarter", "cycle", "custom", "ongoing"] as const
            ).map((h) => ({ value: h, label: HORIZON_LABEL[h] }))}
          />
        </Form.Item>
        {horizon === "cycle" && (
          <Form.Item
            name={"cycleId"}
            label={"Cycle"}
            rules={[{ required: true }]}
            extra={"Its dates default to the cycle's."}
          >
            <Select
              options={activeCycles.map((c) => ({
                value: c.id,
                label: `${c.name} · ${c.startDate} to ${c.endDate}`,
              }))}
            />
          </Form.Item>
        )}
        <Flex gap={16}>
          <Form.Item
            name={"startDate"}
            label={"Starts"}
            rules={[{ required: horizon !== "cycle" }]}
            style={{ flex: 1 }}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          {horizon !== "ongoing" && (
            <Form.Item
              name={"dueDate"}
              label={"Due"}
              rules={[{ required: horizon !== "cycle" }]}
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          )}
        </Flex>

        <Divider titlePlacement={"start"}>Progress</Divider>
        {MODES[type].length > 1 && (
          <Form.Item name={"progressMode"} label={"Progress comes"}>
            <Select
              options={MODES[type].map((m) => ({
                value: m,
                label: MODE_LABEL[m],
              }))}
            />
          </Form.Item>
        )}
        {mode === "subgoals" && (
          <Form.Item
            name={"rollup"}
            label={"Combine sub-goals by"}
            rules={[{ required: true }]}
          >
            <Select
              options={(type === "outcome"
                ? (["average", "weighted", "sum"] as const)
                : (["average", "weighted"] as const)
              ).map((r) => ({ value: r, label: ROLLUP_LABEL[r] }))}
            />
          </Form.Item>
        )}
        {mode === "manual" && (
          <Form.Item
            name={"manualProgress"}
            label={"Progress so far (%)"}
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={100} precision={0} />
          </Form.Item>
        )}
        {type === "outcome" && (
          <Flex gap={16}>
            <Form.Item
              name={"startValue"}
              label={"Start"}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name={"targetValue"}
              label={"Target"}
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <InputNumber style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name={"unit"}
              label={"Unit"}
              rules={[{ max: 20 }]}
              style={{ flex: 1 }}
            >
              <Input placeholder={"books"} maxLength={20} />
            </Form.Item>
          </Flex>
        )}
        {type === "habit" && (
          <>
            <Flex gap={16}>
              <Form.Item
                name={"frequency"}
                label={"How often"}
                rules={[{ required: true }]}
                style={{ flex: 1 }}
              >
                <Select
                  options={(
                    ["daily", "weekdays", "weekly", "monthly"] as const
                  ).map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
                />
              </Form.Item>
              {(frequency === "weekly" || frequency === "monthly") && (
                <Form.Item
                  name={"timesPerPeriod"}
                  label={
                    frequency === "weekly" ? "Times a week" : "Times a month"
                  }
                  rules={[{ required: true }]}
                  style={{ flex: 1 }}
                >
                  <InputNumber
                    min={1}
                    max={frequency === "weekly" ? 7 : 31}
                    precision={0}
                    style={{ width: "100%" }}
                  />
                </Form.Item>
              )}
            </Flex>
            {frequency === "weekdays" && (
              <Form.Item
                name={"weekdays"}
                label={"On"}
                rules={[{ required: true, type: "array", min: 1 }]}
              >
                <Checkbox.Group options={WEEKDAYS} />
              </Form.Item>
            )}
            <Flex gap={16}>
              <Form.Item
                name={"quantityTarget"}
                label={"Counted by amount (optional)"}
                style={{ flex: 1 }}
                extra={"A day counts once it reaches this."}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name={"quantityUnit"}
                label={"Unit"}
                style={{ flex: 1 }}
              >
                <Input
                  disabled={!quantityTarget}
                  placeholder={"min"}
                  maxLength={20}
                />
              </Form.Item>
            </Flex>
          </>
        )}
        {type === "milestone" && mode === "milestones" && !editing && (
          <Form.List name={"milestones"}>
            {(fields, { add, remove }) => (
              <Form.Item label={"Milestones, in order"}>
                <Space orientation={"vertical"} style={{ width: "100%" }}>
                  {fields.map((field, index) => (
                    <Flex key={field.key} gap={8} align={"baseline"}>
                      <Form.Item
                        name={[field.name, "title"]}
                        noStyle={true}
                        rules={[{ max: 120 }]}
                      >
                        <Input
                          placeholder={`Milestone ${index + 1}`}
                          maxLength={120}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, "dueDate"]} noStyle={true}>
                        <DatePicker placeholder={"Due"} />
                      </Form.Item>
                      <Button
                        type={"text"}
                        icon={<DeleteOutlined />}
                        aria-label={`Remove milestone ${index + 1}`}
                        onClick={() => remove(field.name)}
                      />
                    </Flex>
                  ))}
                  <Button
                    type={"dashed"}
                    icon={<PlusOutlined />}
                    onClick={() => add({ title: "" })}
                  >
                    Add milestone
                  </Button>
                </Space>
              </Form.Item>
            )}
          </Form.List>
        )}
        {(type === "outcome" || type === "milestone") && (
          <Form.Item
            name={"tolerancePct"}
            label={"Tolerance (%)"}
            extra={
              "How far behind pace still counts as on track; twice this is at risk. 10 by default."
            }
          >
            <InputNumber min={1} max={50} precision={0} />
          </Form.Item>
        )}

        <Divider titlePlacement={"start"}>More</Divider>
        <Form.Item name={"tagIds"} label={"Tags"}>
          <TagPicker tags={tags} onCreated={onTagCreated} />
        </Form.Item>
        <Flex gap={16}>
          <Form.Item
            name={"weight"}
            label={"Weight among siblings"}
            style={{ flex: 1 }}
          >
            <InputNumber min={0.1} max={1000} style={{ width: "100%" }} />
          </Form.Item>
          {!editing && (
            <Form.Item name={"status"} label={"Start as"} style={{ flex: 1 }}>
              <Radio.Group
                optionType={"button"}
                options={[
                  { value: "active", label: "Active" },
                  { value: "draft", label: "Draft" },
                ]}
              />
            </Form.Item>
          )}
        </Flex>
      </Form>
    </Drawer>
  );
};

export default GoalFormDrawer;
