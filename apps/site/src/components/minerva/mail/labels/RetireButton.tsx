import type { MailLabel } from "@ncfritz/olympus-sdk/minerva";
import { Button, Flex, Popover, Select, Typography } from "antd";
import React, { useState } from "react";

const { Text } = Typography;

/** Retires a label into another topical label of its account. */
const RetireButton: React.FunctionComponent<{
  label: MailLabel;
  labels: MailLabel[];
  onRetire: (targetId: string) => Promise<void>;
}> = ({ label, labels, onRetire }) => {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>();
  const [saving, setSaving] = useState(false);
  const targets = labels.filter(
    (l) =>
      l.id !== label.id &&
      l.accountId === label.accountId &&
      (l.kind === "topical" || l.kind === "state"),
  );
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={"click"}
      title={`Retire ${label.name} into…`}
      content={
        <Flex vertical={true} gap={8} style={{ width: 320 }}>
          <Select
            showSearch={true}
            optionFilterProp={"label"}
            value={target}
            onChange={setTarget}
            placeholder={"The label to merge it into"}
            options={targets.map((l) => ({ value: l.id, label: l.name }))}
          />
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            Picking {label.name} will apply the target instead. Its mail moves
            when merges are applied (phase 4).
          </Text>
          <Button
            type={"primary"}
            size={"small"}
            disabled={!target}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onRetire(target!);
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            Retire
          </Button>
        </Flex>
      }
    >
      <Button size={"small"} type={"link"}>
        Retire…
      </Button>
    </Popover>
  );
};

export default RetireButton;
