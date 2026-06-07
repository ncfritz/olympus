import { Form, Select, Space } from "antd";
import { Controller } from "react-hook-form";
import type { DestinationFormProps } from "./WebSocketDestinationForm";

const SynologyChatDestinationForm: React.FunctionComponent<
  DestinationFormProps
> = ({ control }: DestinationFormProps) => {
  return (
    <Space orientation={"vertical"} size={8} style={{ width: "100%" }}>
      <Form.Item
        label={"Delivery Type"}
        tooltip={"The type of chat destination to deliver the notification to."}
      >
        <Controller
          name="synoChatDestination.destinationType"
          control={control}
          render={({ field }: { field: any }) => (
            <Select
              {...field}
              options={[
                {
                  value: "bot",
                  label: "Chat Bot",
                },
                {
                  value: "channel",
                  label: "Chat Channel",
                },
              ]}
            />
          )}
        />
      </Form.Item>
      <Form.Item
        label={"Delivery Destination"}
        tooltip={"The chat channel or bot to deliver the message to"}
      >
        <Controller
          name="synoChatDestination.destination"
          control={control}
          render={({ field }: { field: any }) => (
            <Select
              {...field}
              options={[
                {
                  value: "olympus",
                  label: "#Olympus",
                },
              ]}
            />
          )}
        />
      </Form.Item>
    </Space>
  );
};
export default SynologyChatDestinationForm;
