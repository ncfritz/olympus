import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteRowOutlined,
  InsertRowAboveOutlined,
  InsertRowBelowOutlined,
} from "@ant-design/icons";
import {
  Button,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Select,
  Space,
} from "antd";
import dayjs from "dayjs";
import React from "react";
import {
  type Control,
  Controller,
  type UseFieldArrayAppend,
  type UseFieldArrayPrepend,
  type UseFieldArrayRemove,
  type UseFormRegister,
} from "react-hook-form";
import {
  EMPTY_JOB_HISTORY_ENTRY,
  type JobHistoryFormData,
} from "../data/JobHistoryPanel";

export interface JobHistoryEntryRowProps {
  index: number;
  count: number;
  control: Control<JobHistoryFormData>;
  register: UseFormRegister<JobHistoryFormData>;
  formActions: {
    append: UseFieldArrayAppend<JobHistoryFormData>;
    prepend: UseFieldArrayPrepend<JobHistoryFormData>;
    remove: UseFieldArrayRemove;
  };
}

const JobHistoryEntryRow: React.FunctionComponent<JobHistoryEntryRowProps> = ({
  index,
  count,
  control,
  register,
  formActions,
}) => {
  return (
    <Row gutter={8}>
      <Col span={5}>
        <Controller
          name={`entries.${index}.jobTitle`}
          control={control}
          rules={{ required: true }}
          render={({ field, fieldState }) => (
            <Form.Item
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error ? fieldState.error.message : undefined}
            >
              <Input
                {...register(`entries.${index}.jobTitle`)}
                {...field}
                size={"small"}
                placeholder="Job title"
                allowClear={true}
                data-1p-ignore={true}
              />
            </Form.Item>
          )}
        />
      </Col>
      <Col span={4}>
        <Controller
          name={`entries.${index}.start`}
          control={control}
          rules={{ required: true }}
          render={({ field, fieldState }) => (
            <Form.Item
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error ? fieldState.error.message : undefined}
            >
              <DatePicker
                {...register(`entries.${index}.start`)}
                value={field.value ? dayjs(field.value) : undefined}
                onChange={(_, dateString) => {
                  field.onChange(dateString); // No need of a state
                }}
                style={{ width: "100%" }}
                size={"small"}
              />
            </Form.Item>
          )}
        />
      </Col>
      <Col span={4}>
        <Controller
          name={`entries.${index}.end`}
          control={control}
          render={({ field, fieldState }) => (
            <Form.Item
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error ? fieldState.error.message : undefined}
            >
              <DatePicker
                {...register(`entries.${index}.end`)}
                value={field.value ? dayjs(field.value) : undefined}
                onChange={(_, dateString) => {
                  field.onChange(dateString); // No need of a state
                }}
                style={{ width: "100%" }}
                size={"small"}
              />
            </Form.Item>
          )}
        />
      </Col>
      <Col span={2}>
        <Controller
          name={`entries.${index}.level`}
          control={control}
          rules={{ required: true }}
          render={({ field, fieldState }) => (
            <Form.Item
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error ? fieldState.error.message : undefined}
            >
              <Select
                {...register(`entries.${index}.level`)}
                {...field}
                value={field.value}
                style={{ width: "100%" }}
                size={"small"}
                options={[
                  { value: -1, label: "Unknown" },
                  { value: 3, label: "L3" },
                  { value: 4, label: "L4" },
                  { value: 5, label: "L5" },
                  { value: 6, label: "L6" },
                  { value: 7, label: "L7" },
                  { value: 8, label: "L8" },
                ]}
              />
            </Form.Item>
          )}
        />
      </Col>
      <Col span={1} style={{ alignContent: "center" }}>
        <Controller
          name={`entries.${index}.fte`}
          control={control}
          render={({ field, fieldState }) => (
            <Checkbox
              {...register(`entries.${index}.fte`)}
              {...field}
              checked={field.value}
            />
          )}
        />
      </Col>
      <Col span={2}>
        <Space direction={"horizontal"} size={4}>
          <Button
            type={"primary"}
            size={"small"}
            icon={<InsertRowAboveOutlined />}
            onClick={() => {
              formActions.prepend(EMPTY_JOB_HISTORY_ENTRY);
            }}
          />
          <Button
            type={"primary"}
            size={"small"}
            icon={<InsertRowBelowOutlined />}
            onClick={() => {
              formActions.append(EMPTY_JOB_HISTORY_ENTRY);
            }}
          />
          <Button type={"default"} size={"small"} icon={<ArrowUpOutlined />} />
          <Button
            type={"default"}
            size={"small"}
            icon={<ArrowDownOutlined />}
          />
          <Button
            type={"primary"}
            size={"small"}
            danger={true}
            disabled={count <= 1}
            icon={<DeleteRowOutlined />}
            onClick={() => {
              formActions.remove(index);
            }}
          />
        </Space>
      </Col>
    </Row>
  );
};
export default JobHistoryEntryRow;
