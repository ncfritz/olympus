import { Card, Descriptions, Flex, Typography } from "antd";
import type { ProfileSettings } from "@/lib/api/types";
import { SECTIONS, type SettingKey, settingLines } from "@/lib/profileSettings";
import { SettingLabel } from "./SettingLabel";

/** A version's settings, read: one card per section, each with its help. */
export function ProfileSettingsView({
  settings,
  kind = "x509",
}: {
  settings: ProfileSettings;
  kind?: "x509" | "ssh";
}) {
  // An SSH version's settings are its own, with the key rules it shares.
  const sections: { key: string; title: string; settings: SettingKey[] }[] =
    kind === "ssh"
      ? [
          {
            key: "ssh",
            title: "SSH certificates",
            settings: ["ssh", "keyAlgorithms", "maxKeyAgeDays"],
          },
        ]
      : SECTIONS;
  return (
    <Flex vertical gap="middle">
      {sections.map((section) => (
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
