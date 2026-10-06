import type { MailAuditAction } from "@ncfritz/olympus-sdk/minerva";
import { Tag } from "antd";
import React from "react";
import { percent } from "../../../../utils/mailAudit";

/**
 * A proposed change as the design draws it: blue with `+` to add a label,
 * volcano and struck through to remove one, with its confidence.
 */
const ChangeTag: React.FunctionComponent<{
  action: MailAuditAction;
  label: string;
  confidence?: number;
}> = ({ action, label, confidence }) =>
  action === "add" ? (
    <Tag color={"blue"} style={{ marginInlineEnd: 4 }}>
      + {label}
      {confidence === undefined ? null : ` · ${percent(confidence)}`}
    </Tag>
  ) : (
    <Tag color={"volcano"} style={{ marginInlineEnd: 4 }}>
      <span style={{ textDecoration: "line-through" }}>{label}</span>
      {confidence === undefined ? null : ` · ${percent(confidence)}`}
    </Tag>
  );

export default ChangeTag;
