import { Empty, Flex, Table, Typography } from "antd";
import type { ProfileSettings } from "@/lib/api/types";
import { changedSettings, type SettingChange } from "@/lib/profileSettings";

const Lines = ({ lines }: { lines: string[] }) =>
  lines.length ? (
    <Flex vertical>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </Flex>
  ) : (
    <Typography.Text type="secondary">None</Typography.Text>
  );

/** Every setting that differs between two versions, side by side. */
export function ProfileDiff({
  before,
  after,
  beforeTitle,
  afterTitle,
}: {
  before: ProfileSettings;
  after: ProfileSettings;
  beforeTitle: string;
  afterTitle: string;
}) {
  const changes = changedSettings(before, after);
  if (!changes.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="The same settings"
      />
    );
  }
  return (
    <Table<SettingChange>
      rowKey="key"
      size="small"
      pagination={false}
      dataSource={changes}
      columns={[
        { title: "Setting", dataIndex: "label" },
        {
          title: beforeTitle,
          dataIndex: "before",
          render: (lines: string[]) => <Lines lines={lines} />,
        },
        {
          title: afterTitle,
          dataIndex: "after",
          render: (lines: string[]) => <Lines lines={lines} />,
        },
      ]}
    />
  );
}
