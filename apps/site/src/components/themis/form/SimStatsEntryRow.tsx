import { Col, Form, Input, Row, Typography } from "antd";
import React from "react";
import {
  type Control,
  Controller,
  type UseFormRegister,
} from "react-hook-form";
import type { SimMetric } from "../../../types/themis";
import type { SimStatsFormData } from "../data/SimStatsPanel";

export interface SimStatsEntryRowProps {
  week: number;
  index: number;
  control: Control<SimStatsFormData>;
  register: UseFormRegister<SimStatsFormData>;
}

const CodeStatsEntryRow: React.FunctionComponent<SimStatsEntryRowProps> = ({
  week,
  index,
  control,
  register,
}) => {
  return (
    <Row gutter={8} style={{ alignItems: "center" }}>
      <Col span={2} style={{ textAlign: "end" }}>
        <Typography.Text style={{ fontSize: "12px" }}>W{week}</Typography.Text>
        <Controller
          name={`stats.${index}.week`}
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <Input
              {...register(`stats.${index}.week`)}
              {...field}
              hidden={true}
            />
          )}
        />
      </Col>
      <Col span={11}>
        <Row gutter={8}>
          {[1, 2, 3, 4, 5, 99, "total"].map(
            (metric: 1 | 2 | 3 | 4 | 5 | 99 | "total") => {
              return (
                <Col
                  span={metric === "total" ? 6 : 3}
                  className={index === 5 ? "b-r1" : ""}
                >
                  <Controller
                    name={`stats.${index}.created.${metric}`}
                    control={control}
                    rules={{ required: true, min: 0 }}
                    render={({ field, fieldState }) => (
                      <Form.Item
                        validateStatus={fieldState.error ? "error" : undefined}
                        help={
                          fieldState.error
                            ? fieldState.error.message
                            : undefined
                        }
                      >
                        <Input
                          {...register(`stats.${index}.created.${metric}`)}
                          {...field}
                          size={"small"}
                          placeholder="n"
                          data-1p-ignore={true}
                          styles={{
                            input: {
                              fontSize: 11,
                              fontFamily: "'Courier New', monospace",
                            },
                          }}
                        />
                      </Form.Item>
                    )}
                  />
                </Col>
              );
            },
          )}
        </Row>
      </Col>
      <Col span={11}>
        <Row gutter={8}>
          {[1, 2, 3, 4, 5, 99, "total"].map(
            (metric: 1 | 2 | 3 | 4 | 5 | 99 | "total") => {
              return (
                <Col
                  span={metric === "total" ? 6 : 3}
                  className={index === 5 ? "b-r1" : ""}
                >
                  <Controller
                    name={`stats.${index}.resolved.${metric}`}
                    control={control}
                    rules={{ required: true, min: 0 }}
                    render={({ field, fieldState }) => (
                      <Form.Item
                        validateStatus={fieldState.error ? "error" : undefined}
                        help={
                          fieldState.error
                            ? fieldState.error.message
                            : undefined
                        }
                      >
                        <Input
                          {...register(`stats.${index}.resolved.${metric}`)}
                          {...field}
                          size={"small"}
                          placeholder="n"
                          data-1p-ignore={true}
                          styles={{
                            input: {
                              fontSize: 11,
                              fontFamily: "'Courier New', monospace",
                            },
                          }}
                        />
                      </Form.Item>
                    )}
                  />
                </Col>
              );
            },
          )}
        </Row>
      </Col>
    </Row>
  );
};
export default CodeStatsEntryRow;
