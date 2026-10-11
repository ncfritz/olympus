import { QuestionCircleOutlined } from "@ant-design/icons";
import { Flex, Tooltip } from "antd";
import { SETTINGS, type SettingKey } from "@/lib/profileSettings";

/** A setting's label, its help in a tooltip on the question mark. */
export function SettingLabel({ setting }: { setting: SettingKey }) {
  const { label, help } = SETTINGS[setting];
  return (
    <Flex gap={6} align="center">
      {label}
      <Tooltip title={help}>
        <QuestionCircleOutlined aria-label={`About ${label}`} />
      </Tooltip>
    </Flex>
  );
}
