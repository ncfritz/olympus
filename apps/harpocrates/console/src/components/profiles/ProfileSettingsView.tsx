import { Card, Descriptions, Flex, Typography } from "antd";
import type { ProfileSettings } from "@/lib/api/types";
import { SECTIONS, settingLines } from "@/lib/profileSettings";
import { SettingLabel } from "./SettingLabel";

/** A version's settings, read: one card per section, each with its help. */
export function ProfileSettingsView({
  settings,
}: {
  settings: ProfileSettings;
}) {
  return (
    <Flex vertical gap="middle">
      {SECTIONS.map((section) => (
        <Card key={section.key} size="small" title={section.title}>
          <Descriptions
            column={1}
            size="small"
            items={section.settings.map((key) => {
              const lines = settingLines(key, settings);
              return {
                key,
                label: <SettingLabel setting={key} />,
                children: lines.length ? (
                  <Flex vertical>
                    {lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </Flex>
                ) : (
                  <Typography.Text type="secondary">None</Typography.Text>
                ),
              };
            })}
          />
        </Card>
      ))}
    </Flex>
  );
}
