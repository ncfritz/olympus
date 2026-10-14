"use client";

import { CheckOutlined, CloseOutlined, CopyOutlined } from "@ant-design/icons";
import { Card } from "antd";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./ValueCard.module.css";

export type CopyStatus = "idle" | "copied" | "failed";

/** How long a copy's outcome shows before the action reads Copy again. */
const COPY_STATUS_MS = 2000;

/**
 * Copying to the clipboard, its outcome held for a moment so the control
 * that did it can show it (rather than a message announcing it).
 */
export const useCopy = (text: string) => {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    timer.current = setTimeout(() => setStatus("idle"), COPY_STATUS_MS);
  };
  return { status, copy };
};

/** A copy control's icon and words for its status. */
export const COPY_LABELS: Record<
  CopyStatus,
  { icon: ReactNode; text: string }
> = {
  idle: { icon: <CopyOutlined />, text: "Copy" },
  copied: { icon: <CheckOutlined />, text: "Copied" },
  failed: { icon: <CloseOutlined />, text: "Couldn't copy" },
};

/** An action in a value card's row, before its Copy. */
export interface ValueCardAction {
  key: string;
  icon: ReactNode;
  text: string;
  /** What a screen reader says it does. */
  label: string;
  onClick: () => void;
}

/** One cell of the action row: all of it a button. */
function Action({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-live="polite"
      className={`${styles.action} ${className ?? ""}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </span>
  );
}

/**
 * A value in a card of its own: a long hex value (a serial, a fingerprint,
 * a key identifier), small enough to read whole, or a secret shown once
 * (the signer's unseal key), larger. The card's action row is its copy
 * control, as antd's card actions are: the whole row is clickable, and it
 * says Copied (or that it couldn't) for a moment after; other actions,
 * when given, come before it.
 */
export function ValueCard({
  value,
  label,
  size = "small",
  actions = [],
}: {
  value: string;
  /** What the value is, for the copy control's name. */
  label: string;
  size?: "small" | "large";
  actions?: ValueCardAction[];
}) {
  const { status, copy } = useCopy(value);
  return (
    <Card
      size="small"
      className={styles.card}
      classNames={{ body: styles.body, actions: styles.actions }}
      actions={[
        ...actions.map((a) => (
          <Action key={a.key} label={a.label} onClick={a.onClick}>
            {a.icon} {a.text}
          </Action>
        )),
        <Action
          key="copy"
          label={`Copy the ${label}`}
          className={styles[status]}
          onClick={() => void copy()}
        >
          {COPY_LABELS[status].icon} {COPY_LABELS[status].text}
        </Action>,
      ]}
    >
      <span className={`${styles.value} ${styles[size]}`}>{value}</span>
    </Card>
  );
}
