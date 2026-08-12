import { Slider, Space, Tag } from "antd";
import React, { type CSSProperties, useState } from "react";
import FilterWrapper from "./FilterWrapper";

export interface DurationFilterProps {
  label: string;
  min: number;
  max: number;
  tickInterval?: number;
  onFiltersSet: (values: number[]) => void;
}

const MARK_STYLE: CSSProperties = { fontSize: "11px", whiteSpace: "nowrap" };

const DurationFilter: React.FunctionComponent<DurationFilterProps> = ({
  label,
  min,
  max,
  tickInterval,
  onFiltersSet,
}: DurationFilterProps) => {
  const [range, setRange] = useState<[number, number] | []>([]);
  const [rangeSet, setRangeSet] = useState(0);

  const handleRange = (values: [number, number]) => {
    setRange(values);
    setRangeSet(rangeSet + 1);
  };

  let marks:
    Record<number, { label: string; style: CSSProperties }> | undefined =
    undefined;

  if (tickInterval) {
    marks = {};

    for (let i = min; i <= max; i += tickInterval) {
      marks[i] = {
        label: i.toString(),
        style: MARK_STYLE,
      };
    }
  }

  return (
    <FilterWrapper
      label={label}
      initialFiltersPresent={range.length > 0}
      filters={
        <Space
          orientation={"vertical"}
          size={8}
          style={{ height: 400 }}
          styles={{ item: { height: "100%" } }}
        >
          <Space
            orientation={"horizontal"}
            style={{ padding: 16, height: "100%" }}
            styles={{ item: { height: "100%" } }}
          >
            <Slider
              min={min}
              max={max}
              marks={marks}
              step={1}
              range={true}
              value={range}
              orientation={"vertical"}
              style={{ paddingBottom: 8, width: 90 }}
              onChange={handleRange}
            />
            <Space
              orientation={"vertical"}
              size={8}
              style={{
                alignItems: "end",
                height: "100%",
                justifyContent: "space-between",
              }}
            >
              <Tag>{range[1]}</Tag>
              <Tag style={{ position: "relative", bottom: -10 }}>
                {range[0]}
              </Tag>
            </Space>
          </Space>
        </Space>
      }
      onReset={() => {
        setRange([]);
        setRangeSet(0);
      }}
      onClear={() => {
        setRange([]);
        setRangeSet(0);
      }}
      onClose={() => {
        onFiltersSet(rangeSet ? range : []);
        return rangeSet > 0 ? 1 : 0;
      }}
    />
  );
};
export default DurationFilter;
