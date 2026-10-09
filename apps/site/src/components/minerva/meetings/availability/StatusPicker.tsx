import { Button, Flex } from "antd";
import React, { useState } from "react";
import { OVERRIDE_STATUSES } from "../../../../utils/meetingAvailability";
import type { OnAirStatus } from "../../../../utils/onair";
import styles from "./Availability.module.css";

export interface StatusPickerProps {
  /** The status shown now. */
  status: OnAirStatus;
  /** Whether that status is an override (marked as chosen) or a default. */
  overridden: boolean;
  onSelect: (status: OnAirStatus) => Promise<void>;
  /** Removing: a meeting's override, or a whole block. */
  onRemove?: () => Promise<void>;
  removeLabel?: string;
}

/**
 * The OnAir drawer's four statuses, and a way back: the picker behind a
 * meeting's or block's status dot.
 */
const StatusPicker: React.FunctionComponent<StatusPickerProps> = ({
  status,
  overridden,
  onSelect,
  onRemove,
  removeLabel = "Remove override",
}: StatusPickerProps) => {
  const [saving, setSaving] = useState<string>();

  const run = async (key: string, action: () => Promise<void>) => {
    setSaving(key);
    try {
      await action();
    } finally {
      setSaving(undefined);
    }
  };

  return (
    <Flex vertical={true} gap={4} className={styles.picker}>
      {OVERRIDE_STATUSES.map((option) => (
        <Button
          key={option.status}
          block={true}
          type={overridden && option.status === status ? "primary" : "default"}
          loading={saving === option.status}
          disabled={saving !== undefined}
          onClick={() => run(option.status, () => onSelect(option.status))}
        >
          <Flex gap={8} align={"center"} flex={1}>
            <span
              className={`${styles.pickerSwatch} oa-light-status-${option.status}`}
            />
            {option.label}
          </Flex>
        </Button>
      ))}
      {onRemove && (
        <Button
          block={true}
          danger={true}
          loading={saving === "remove"}
          disabled={saving !== undefined}
          onClick={() => run("remove", onRemove)}
        >
          {removeLabel}
        </Button>
      )}
    </Flex>
  );
};

export default StatusPicker;
