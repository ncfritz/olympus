import { Col, Form, Input, Row, Typography } from "antd";
import React from "react";
import {
  type Control,
  Controller,
  type UseFormRegister,
} from "react-hook-form";
import type { CodeStatsFormData } from "../data/CodeStatsPanel";

export interface CodeStatsEntryRowProps {
  week: number;
  index: number;
  control: Control<CodeStatsFormData>;
  register: UseFormRegister<CodeStatsFormData>;
}

const CodeStatsEntryRow: React.FunctionComponent<CodeStatsEntryRowProps> = ({
  week,
  index,
  control,
  register,
}) => {
  return (
    <Row gutter={8} style={{ alignItems: "center" }}>
      <Col span={4} style={{ textAlign: "end" }}>
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
      {["changes", "added", "removed", "packages"].map(
        (metric: "changes" | "added" | "removed" | "packages") => {
          return (
            <Col span={4}>
              <Controller
                name={`stats.${index}.${metric}`}
                control={control}
                rules={{ required: true, min: 0 }}
                render={({ field, fieldState }) => (
                  <Form.Item
                    validateStatus={fieldState.error ? "error" : undefined}
                    help={
                      fieldState.error ? fieldState.error.message : undefined
                    }
                  >
                    <Input
                      {...register(`stats.${index}.${metric}`)}
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
  );
};
export default CodeStatsEntryRow;
