import { Button, Col, Row, Slider, Space, Tag } from "antd";
import React, { useState } from "react";
import FilterWrapper from "./FilterWrapper";

export interface AgeRangeFilterProps {
  label: string;
  onFiltersSet: (values: number[]) => void;
}

const AgeRangeFilter: React.FunctionComponent<AgeRangeFilterProps> = ({
  label,
  onFiltersSet,
}: AgeRangeFilterProps) => {
  const [ageRange, setAgeRange] = useState([0, 120]);
  const [rangeSet, setRangeSet] = useState(0);

  const handleRange = (values: number[]) => {
    setAgeRange(values);
    setRangeSet(rangeSet + 1);
  };

  return (
    <FilterWrapper
      label={label}
      filters={
        <Space direction={"vertical"} size={8} style={{}}>
          <Space
            direction={"vertical"}
            style={{ padding: 16, width: "100%" }}
            styles={{ item: { width: "100%" } }}
          >
            <Slider
              min={0}
              max={120}
              step={1}
              range={true}
              value={ageRange}
              style={{ width: 350, paddingBottom: 8 }}
              onChange={handleRange}
            />
            <Space
              direction={"horizontal"}
              size={8}
              style={{
                alignItems: "center",
                width: "100%",
                justifyContent: "space-between",
              }}
            >
              <Tag>{ageRange[0]}</Tag>
              <Tag>{ageRange[1]}</Tag>
            </Space>
          </Space>
          <Space direction={"vertical"} style={{ width: "100%", padding: 8 }}>
            <Row gutter={8}>
              <Col span={12}>
                <Button
                  color={"default"}
                  variant={"filled"}
                  block={true}
                  onClick={() => handleRange([0, 1])}
                >
                  Baby (0-2)
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  color={"default"}
                  variant={"filled"}
                  block={true}
                  size={"small"}
                  onClick={() => handleRange([2, 4])}
                >
                  Toddler (2-4)
                </Button>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={12}>
                <Button
                  color={"default"}
                  variant={"filled"}
                  block={true}
                  size={"small"}
                  onClick={() => handleRange([5, 12])}
                >
                  Child (5-12)
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  color={"default"}
                  variant={"filled"}
                  block={true}
                  size={"small"}
                  onClick={() => handleRange([13, 19])}
                >
                  Teen (13-19)
                </Button>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={12}>
                <Button
                  color={"default"}
                  variant={"filled"}
                  block={true}
                  size={"small"}
                  onClick={() => handleRange([20, 39])}
                >
                  Adult (20-39)
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  color={"default"}
                  variant={"filled"}
                  block={true}
                  size={"small"}
                  onClick={() => handleRange([40, 59])}
                >
                  Middle Age (40-59)
                </Button>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={12}>
                <Button
                  color={"default"}
                  variant={"filled"}
                  block={true}
                  size={"small"}
                  onClick={() => handleRange([60, 120])}
                >
                  Senior (60+)
                </Button>
              </Col>
            </Row>
          </Space>
        </Space>
      }
      onReset={() => {
        setAgeRange([0, 120]);
        setRangeSet(0);
      }}
      onClose={() => {
        onFiltersSet(rangeSet ? ageRange : []);
        return rangeSet > 0 ? 1 : 0;
      }}
    />
  );
};
export default AgeRangeFilter;
