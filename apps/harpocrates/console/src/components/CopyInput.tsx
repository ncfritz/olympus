"use client";

import { Button, Input, Space } from "antd";
import styles from "./CopyInput.module.css";
import { COPY_LABELS, useCopy } from "./ValueCard";

/**
 * A short value to copy whole, such as a command: read-only, in the code
 * font, its copy button attached. Focusing it selects all of it.
 */
export function CopyInput({ value, label }: { value: string; label: string }) {
  const { status, copy } = useCopy(value);
  return (
    <Space.Compact block>
      <Input
        readOnly
        value={value}
        className={styles.input}
        aria-label={label}
        onFocus={(event) => event.target.select()}
      />
      <Button
        icon={COPY_LABELS[status].icon}
        className={styles[status]}
        aria-live="polite"
        onClick={() => void copy()}
      >
        {COPY_LABELS[status].text}
      </Button>
    </Space.Compact>
  );
}
