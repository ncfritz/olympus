import { Button, Col, Row, Slider, Space, Tag } from "antd";
import React, { type CSSProperties, useState } from "react";
import FilterWrapper from "./FilterWrapper";

export interface DurationFilterProps {
  label: string;
  onFiltersSet: (values: number[]) => void;
}

const MARK_STYLE: CSSProperties = { fontSize: "11px", whiteSpace: "nowrap" };

const DurationFilter: React.FunctionComponent<DurationFilterProps> = ({
  label,
  onFiltersSet,
}: DurationFilterProps) => {
  const [durationRange, setDurationRange] = useState([45, 240]);
  const [rangeSet, setRangeSet] = useState(0);

  const handleRange = (values: number[]) => {
    setDurationRange(values);
    setRangeSet(rangeSet + 1);
  };

  return (
    <FilterWrapper
      label={label}
      initialFiltersPresent={durationRange.length > 0}
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
              min={0}
              max={480}
              marks={{
                0: { label: "0m", style: MARK_STYLE },
                30: { label: "30m", style: MARK_STYLE },
                60: { label: "60m", style: MARK_STYLE },
                90: { label: "1h 30m", style: MARK_STYLE },
                120: { label: "2h", style: MARK_STYLE },
                150: { label: "2h 30m", style: MARK_STYLE },
                180: { label: "3h", style: MARK_STYLE },
                210: { label: "3h 30m", style: MARK_STYLE },
                240: { label: "4h", style: MARK_STYLE },
                270: { label: "4h 30m", style: MARK_STYLE },
                300: { label: "5h", style: MARK_STYLE },
                330: { label: "5h 30m", style: MARK_STYLE },
                360: { label: "6h", style: MARK_STYLE },
                390: { label: "6h 30m", style: MARK_STYLE },
                420: { label: "7h", style: MARK_STYLE },
                450: { label: "7h 30m", style: MARK_STYLE },
                480: { label: "8h", style: MARK_STYLE },
              }}
              step={1}
              range={true}
              value={durationRange}
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
              <Tag>{durationRange[1]}</Tag>
              <Tag style={{ position: "relative", bottom: -10 }}>
                {durationRange[0]}
              </Tag>
            </Space>
          </Space>
        </Space>
      }
      onReset={() => {
        setDurationRange([45, 240]);
        setRangeSet(0);
      }}
      onClear={() => {
        setDurationRange([]);
        setRangeSet(0);
      }}
      onClose={() => {
        onFiltersSet(rangeSet ? durationRange : []);
        return rangeSet > 0 ? 1 : 0;
      }}
    />
  );
};
export default DurationFilter;
