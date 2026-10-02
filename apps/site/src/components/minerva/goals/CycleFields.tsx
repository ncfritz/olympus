import { CalendarOutlined } from "@ant-design/icons";
import { DatePicker, Flex, Input, InputNumber } from "antd";
import dayjs from "dayjs";
import React from "react";

/** A cycle's editable values, as the drawer and the plan dialog hold them. */
export type CycleValues = {
  name: string;
  startDate: string;
  weeks: number;
  bufferWeeks: number;
};

/** Only Mondays can start a cycle. */
export const notMonday = (d: dayjs.Dayjs) => d.day() !== 1;

/**
 * A cycle's name, Monday start, weeks (1–26) and buffer weeks (0–2), as a
 * row of small fields. `onCommit` fires when a field is left or a date
 * picked, for saving in place.
 */
const CycleFields: React.FunctionComponent<{
  value: CycleValues;
  onChange: (value: CycleValues) => void;
  onCommit?: (value: CycleValues) => void;
  size?: "small" | "middle";
  error?: boolean;
  label: string;
}> = ({ value, onChange, onCommit, size = "small", error, label }) => {
  const set = (changes: Partial<CycleValues>, commit = false) => {
    const next = { ...value, ...changes };
    onChange(next);
    if (commit) onCommit?.(next);
  };
  const caption = (text: string) => (
    <span style={{ fontSize: 12, color: "#595959" }}>{text}</span>
  );
  return (
    <Flex gap={8} wrap={true} align={"flex-end"}>
      <Flex vertical={true} gap={4} style={{ width: 130 }}>
        {caption("Name")}
        <Input
          size={size}
          value={value.name}
          maxLength={50}
          aria-label={`${label} name`}
          onChange={(e) => set({ name: e.target.value })}
          onBlur={() => onCommit?.(value)}
        />
      </Flex>
      <Flex vertical={true} gap={4} style={{ width: 160 }}>
        {caption("Starts (a Monday)")}
        <DatePicker
          size={size}
          value={dayjs(value.startDate)}
          allowClear={false}
          disabledDate={notMonday}
          format={"ddd, MMM D, YYYY"}
          suffixIcon={<CalendarOutlined />}
          status={error ? "error" : undefined}
          aria-label={`${label} start`}
          onChange={(d) =>
            d && set({ startDate: d.format("YYYY-MM-DD") }, true)
          }
        />
      </Flex>
      <Flex vertical={true} gap={4} style={{ width: 70 }}>
        {caption("Weeks")}
        <InputNumber
          size={size}
          min={1}
          max={26}
          precision={0}
          value={value.weeks}
          aria-label={`${label} weeks`}
          onChange={(v) => typeof v === "number" && set({ weeks: v })}
          onBlur={() => onCommit?.(value)}
        />
      </Flex>
      <Flex vertical={true} gap={4} style={{ width: 70 }}>
        {caption("Buffer")}
        <InputNumber
          size={size}
          min={0}
          max={2}
          precision={0}
          value={value.bufferWeeks}
          aria-label={`${label} buffer weeks`}
          onChange={(v) => typeof v === "number" && set({ bufferWeeks: v })}
          onBlur={() => onCommit?.(value)}
        />
      </Flex>
    </Flex>
  );
};

export default CycleFields;
