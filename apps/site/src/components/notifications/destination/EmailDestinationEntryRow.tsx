import { MinusCircleFilled, PlusCircleFilled } from "@ant-design/icons";
import { Button, Input, Space } from "antd";
import {
  type Control,
  Controller,
  type ControllerFieldState,
  type ControllerRenderProps,
  type UseFieldArrayAppend,
  type UseFieldArrayRemove,
} from "react-hook-form";
import type { NotificationFormData } from "../NotificationForm";
import { emailValidationRules } from "./common";

export interface EmailDestinationEntryRowProps {
  formPathPrefix: "synoMailDestination" | "smtpDestination";
  fieldName: "to" | "cc" | "bcc";
  control: Control<NotificationFormData>;
  items: Record<"id", string>[];
  item: Record<"id", string>;
  index: number;
  append: UseFieldArrayAppend<NotificationFormData>;
  remove: UseFieldArrayRemove;
  required?: boolean;
}

const EmailDestinationEntryRow: React.FunctionComponent<
  EmailDestinationEntryRowProps
> = ({
  formPathPrefix,
  fieldName,
  control,
  item,
  items,
  index,
  append,
  remove,
  required = false,
}: EmailDestinationEntryRowProps) => {
  return (
    <Space
      direction={"horizontal"}
      style={{ width: "100%" }}
      key={item.id}
      className={"flex-first-item"}
    >
      <Controller
        // @ts-expect-error known situation
        name={`${formPathPrefix}.${fieldName}.${index}.value`}
        control={control}
        rules={emailValidationRules(required)}
        render={({
          field,
          fieldState,
        }: {
          field: ControllerRenderProps<NotificationFormData>;
          fieldState: ControllerFieldState;
        }) => {
          return (
            <Input
              {...field}
              status={fieldState.error ? "error" : undefined}
              placeholder={"First Last <user@email.com>"}
              suffix={
                <>
                  <Button
                    style={{ padding: 4, margin: 0 }}
                    type={"text"}
                    onClick={() => {
                      append("");
                    }}
                    size={"small"}
                  >
                    <PlusCircleFilled />
                  </Button>
                  <Button
                    style={{ padding: 4, margin: 0 }}
                    type={"text"}
                    danger={true}
                    disabled={required && items.length <= 1}
                    onClick={() => {
                      remove(index);
                    }}
                    size={"small"}
                  >
                    <MinusCircleFilled />
                  </Button>
                </>
              }
            />
          );
        }}
      />
    </Space>
  );
};
export default EmailDestinationEntryRow;
