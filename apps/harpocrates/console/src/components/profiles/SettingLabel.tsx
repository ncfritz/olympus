import { QuestionCircleOutlined } from "@ant-design/icons";
import { Flex, Tooltip } from "antd";
import type { SshProfileSettings } from "@/lib/api/types";
import { SETTINGS, type SettingKey } from "@/lib/profileSettings";
import { SSH_SETTINGS } from "@/lib/ssh";

/** A label, its help in a tooltip on the question mark. */
const HelpLabel = ({ label, help }: { label: string; help: string }) => (
  <Flex gap={6} align="center">
    {label}
    <Tooltip title={help}>
      <QuestionCircleOutlined aria-label={`About ${label}`} />
    </Tooltip>
  </Flex>
);

/** A setting's label, with its help. */
export function SettingLabel({ setting }: { setting: SettingKey }) {
  return <HelpLabel {...SETTINGS[setting]} />;
}

/** One of an SSH version's own settings' label, with its help. */
export function SshSettingLabel({
  setting,
}: {
  setting: keyof SshProfileSettings;
}) {
  return <HelpLabel {...SSH_SETTINGS[setting]} />;
}
