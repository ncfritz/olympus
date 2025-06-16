import {
  CheckCircleFilled,
  CloseCircleFilled,
  InfoCircleFilled,
  WarningFilled,
} from "@ant-design/icons";
import { Radio, Space } from "antd";
import React from "react";
import type { WebSocketNotificationLevel } from "@ncfritz/olympus-types/dist/notifications";

export interface WebSocketLevelButtonProps {
  level: WebSocketNotificationLevel;
  selectedLevel: WebSocketNotificationLevel;
  label: string;
}

const getColorAndIconForLevel = (
  level: WebSocketNotificationLevel,
): [string, any] => {
  switch (level) {
    case "success":
      return ["#52c41a", <CheckCircleFilled />];
    case "warning":
      return ["#faad14", <WarningFilled />];
    case "error":
      return ["#ff4d4f", <CloseCircleFilled />];
    case "info":
    default:
      return ["#1677ff", <InfoCircleFilled />];
  }
};

const WebSocketLevelButton: React.FunctionComponent<
  WebSocketLevelButtonProps
> = ({ level, selectedLevel, label }: WebSocketLevelButtonProps) => {
  const active = selectedLevel === level;
  const [color, icon] = getColorAndIconForLevel(level);

  return (
    <Radio.Button
      style={{
        width: `${(1 / 6) * 100}%`,
        color: `${active ? "#ffffff" : color}`,
        backgroundColor: `${active ? color : "#ffffff"}`,
      }}
      value={level}
    >
      <Space size={8}>
        {icon}
        {label}
      </Space>
    </Radio.Button>
  );
};
export default WebSocketLevelButton;
