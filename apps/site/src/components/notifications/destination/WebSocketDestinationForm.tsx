import { Form, Input, Radio, Slider, Space, Switch } from "antd";
import { Duration } from "luxon";
import prettyMilliseconds from "pretty-ms";
import { type Control, Controller, type UseFormWatch } from "react-hook-form";
import type { NotificationFormData } from "../NotificationForm";
import WebSocketLevelButton from "./WebSocketLevelButton";

export interface DestinationFormProps {
  control: Control<NotificationFormData>;
}

export interface WebSocketDestinationFormProps {
  control: Control<NotificationFormData>;
  watch: UseFormWatch<NotificationFormData>;
}

const WebSocketDestinationForm: React.FunctionComponent<
  WebSocketDestinationFormProps
> = ({ control, watch }: WebSocketDestinationFormProps) => {
  const levelWatch = watch("webSocketDestination.level");
  const durableWatch = watch("webSocketDestination.durable");
  const closableWatch = watch("webSocketDestination.closable");
  const ghostWatch = watch("webSocketDestination.ghost");

  return (
    <Space direction={"vertical"} size={8} style={{ width: "100%" }}>
      <Controller
        name="webSocketDestination.level"
        control={control}
        render={({ field }) => (
          <Form.Item
            label={"Level"}
            name={"layout"}
            tooltip={
              "The severity level to use when announcing the notification"
            }
          >
            <Radio.Group {...field} block={true}>
              <WebSocketLevelButton
                level={"info"}
                selectedLevel={levelWatch}
                label={"Info"}
              />
              <WebSocketLevelButton
                level={"success"}
                selectedLevel={levelWatch}
                label={"Success"}
              />
              <WebSocketLevelButton
                level={"warning"}
                selectedLevel={levelWatch}
                label={"Warning"}
              />
              <WebSocketLevelButton
                level={"error"}
                selectedLevel={levelWatch}
                label={"Error"}
              />
            </Radio.Group>
          </Form.Item>
        )}
      />
      <Controller
        name="webSocketDestination.closable"
        control={control}
        render={({ field }) => (
          <Form.Item
            label={"Closable"}
            tooltip={
              "When selected will allow the user to close the notification"
            }
          >
            <Switch {...field} size={"small"} />
          </Form.Item>
        )}
      />
      <Controller
        name="webSocketDestination.durable"
        control={control}
        render={({ field }) => (
          <Form.Item
            label={"Durable"}
            tooltip={"When selected, will persist the notification"}
          >
            <Switch {...field} size={"small"} />
          </Form.Item>
        )}
      />
      {durableWatch && closableWatch && (
        <Controller
          name="webSocketDestination.deleteOnClose"
          control={control}
          render={({ field }) => (
            <Form.Item
              label={"Delete on Close"}
              tooltip={
                "When selected, AND 'Durable' and 'Closable' are selected, will delete the notification when it is closed."
              }
            >
              <Switch {...field} size={"small"} />
            </Form.Item>
          )}
        />
      )}
      {durableWatch && (
        <Controller
          name="webSocketDestination.ghost"
          control={control}
          render={({ field }) => (
            <Form.Item
              label={"Ghost"}
              tooltip={
                "When selected, AND 'Durable' is selected, will suppress the notification popup in the UI and only persist" +
                "the notification to the notification store."
              }
            >
              {" "}
              <Switch {...field} size={"small"} />
            </Form.Item>
          )}
        />
      )}
      {((!ghostWatch && durableWatch) || !durableWatch) && (
        <Controller
          name="webSocketDestination.visibleDuration"
          control={control}
          render={({ field }) => (
            <Form.Item
              label={"Visibility Duration:"}
              tooltip={
                "The amount of time a notification will be visible in the UI"
              }
            >
              <Slider
                {...field}
                min={1}
                max={180}
                defaultValue={30}
                step={0.25}
                marks={{
                  1: "1s",
                  30: "30s",
                  60: "1m",
                  90: "1m 30s",
                  120: "2m",
                  150: "2m 30s",
                  180: "3m",
                }}
                tooltip={{
                  formatter: (value) => {
                    return prettyMilliseconds(value || 1000);
                  },
                }}
              />
            </Form.Item>
          )}
        />
      )}
      {durableWatch && (
        <Controller
          name="webSocketDestination.group"
          control={control}
          render={({ field }) => (
            <Form.Item
              label={"Notification Group"}
              tooltip={
                "When 'Durable' is selected, specifies the notification group the notification will be added to."
              }
            >
              <Input {...field} placeholder={"general"} />
            </Form.Item>
          )}
        />
      )}
      {durableWatch && (
        <Controller
          name="webSocketDestination.ttl"
          control={control}
          rules={{
            validate: (value) => {
              console.log(value);
              return (
                value === undefined ||
                value.trim() === "" ||
                Duration.fromISO(value).isValid
              );
            },
          }}
          render={({ field, fieldState }) => (
            <Form.Item
              label={"Time To Live (TTL)"}
              tooltip={
                "When specified sets the maximum amount of time a notification can exist before being automatically cleaned" +
                " up."
              }
              validateStatus={fieldState.error ? "error" : undefined}
              help={
                fieldState.error
                  ? "TTL must be a valid ISO-8601 duration."
                  : undefined
              }
            >
              <Input
                {...field}
                placeholder={"P1D"}
                status={fieldState.error ? "error" : undefined}
              />
            </Form.Item>
          )}
        />
      )}
    </Space>
  );
};
export default WebSocketDestinationForm;
