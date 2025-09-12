import { PlusCircleFilled } from "@ant-design/icons";
import { Button, Form, Input, Select, Space } from "antd";
import {
  Controller,
  type ControllerFieldState,
  type ControllerRenderProps,
  useFieldArray,
} from "react-hook-form";
import type { NotificationFormData } from "../NotificationForm";
import { emailValidationRules } from "./common";
import EmailDestinationEntryRow from "./EmailDestinationEntryRow";
import type { DestinationFormProps } from "./WebSocketDestinationForm";

export interface EmailDestinationFormProps extends DestinationFormProps {
  formPathPrefix: "synoMailDestination" | "smtpDestination";
}

const EmailDestinationForm: React.FunctionComponent<
  EmailDestinationFormProps
> = ({ formPathPrefix, control }: EmailDestinationFormProps) => {
  const {
    fields: toFields,
    append: appendTo,
    remove: removeTo,
  } = useFieldArray({
    control,
    name: `${formPathPrefix}.to`,
  });

  const {
    fields: ccFields,
    append: appendCc,
    remove: removeCc,
  } = useFieldArray({
    control,
    name: `${formPathPrefix}.cc`,
  });

  const {
    fields: bccFields,
    append: appendBcc,
    remove: removeBcc,
  } = useFieldArray({
    control,
    name: `${formPathPrefix}.bcc`,
  });

  const toFieldState = control.getFieldState(`${formPathPrefix}.to`);
  const ccFieldState = control.getFieldState(`${formPathPrefix}.cc`);
  const bccFieldState = control.getFieldState(`${formPathPrefix}.bcc`);

  return (
    <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
      {formPathPrefix !== "synoMailDestination" && (
        <Controller
          name={`${formPathPrefix}.priority`}
          control={control}
          render={({
            field,
          }: {
            field: ControllerRenderProps<NotificationFormData>;
          }) => (
            <Form.Item
              label={"Priority"}
              tooltip={
                "The message priority to set when sending the notification."
              }
            >
              <Select
                {...field}
                options={[
                  {
                    value: "1",
                    label: "Highest",
                  },
                  {
                    value: "2",
                    label: "High",
                  },
                  {
                    value: "3",
                    label: "Normal",
                  },
                  {
                    value: "4",
                    label: "Low",
                  },
                  {
                    value: "5",
                    label: "Lowest",
                  },
                ]}
              />
            </Form.Item>
          )}
        />
      )}
      <Controller
        name={`${formPathPrefix}.from`}
        control={control}
        rules={emailValidationRules(true)}
        render={({
          field,
          fieldState,
        }: {
          field: ControllerRenderProps<NotificationFormData>;
          fieldState: ControllerFieldState;
        }) => {
          // @ts-expect-error okay
          const input = <Input {...field} />;

          return (
            <Form.Item
              label={"From Address"}
              tooltip={
                "The address to send the email as, this can be specified as a simple user@email.com or " +
                "RFC 2822 angle address specification"
              }
              validateStatus={fieldState.error ? "error" : undefined}
              help={
                fieldState.error
                  ? "Email is empty or format is invalid"
                  : undefined
              }
            >
              {input}
            </Form.Item>
          );
        }}
      />
      <Form.Item
        label={"Recipient/s"}
        tooltip={
          "The addresses to send the email to, these can be specified as a simple user@email.com or RFC " +
          "2822 angle address specification"
        }
        validateStatus={toFieldState.error ? "error" : undefined}
        help={
          toFieldState.error ? "Email is empty or format is invalid" : undefined
        }
      >
        <Space
          direction={"vertical"}
          style={{ width: "100%" }}
          styles={{ item: { display: "flex" } }}
        >
          {toFields.map((item, index) => (
            <EmailDestinationEntryRow
              formPathPrefix={formPathPrefix}
              fieldName={"to"}
              required={true}
              control={control}
              items={toFields}
              item={item}
              index={index}
              append={appendTo}
              remove={removeTo}
            />
          ))}
        </Space>
      </Form.Item>
      <Form.Item
        label={"Carbon Copy"}
        tooltip={
          "The addresses to send the email to in the CC, these can be specified as a simple user@email.com or " +
          "RFC 2822 angle address specification"
        }
        validateStatus={ccFieldState.error ? "error" : undefined}
        help={ccFieldState.error ? "Email format is invalid." : undefined}
      >
        {ccFields && ccFields.length > 0 ? (
          ccFields.map((item, index) => (
            <EmailDestinationEntryRow
              formPathPrefix={formPathPrefix}
              fieldName={"cc"}
              control={control}
              items={ccFields}
              item={item}
              index={index}
              append={appendCc}
              remove={removeCc}
            />
          ))
        ) : (
          <Button
            block={true}
            icon={<PlusCircleFilled />}
            type={"text"}
            style={{ justifyContent: "start" }}
            onClick={() => {
              appendCc({ value: "" });
            }}
          >
            Add CC recipient
          </Button>
        )}
      </Form.Item>
      <Form.Item
        label={"Blind Carbon Copy"}
        tooltip={
          "The addresses to send the email to in the BCC, these can be specified as a simple user@email.com or " +
          "RFC 2822 angle address specification"
        }
        validateStatus={bccFieldState.error ? "error" : undefined}
        help={bccFieldState.error ? "Email format is invalid." : undefined}
      >
        {bccFields.length > 0 ? (
          bccFields.map((item, index) => (
            <EmailDestinationEntryRow
              formPathPrefix={formPathPrefix}
              fieldName={"bcc"}
              control={control}
              items={bccFields}
              item={item}
              index={index}
              append={appendBcc}
              remove={removeBcc}
            />
          ))
        ) : (
          <Button
            block={true}
            icon={<PlusCircleFilled />}
            type={"text"}
            style={{ justifyContent: "start" }}
            onClick={() => {
              appendBcc({ value: "" });
            }}
          >
            Add BCC recipient
          </Button>
        )}
      </Form.Item>
    </Space>
  );
};
export default EmailDestinationForm;
