import type { MailAuditAction } from "@ncfritz/olympus-sdk/minerva";
import { Tag } from "antd";
import React from "react";
import { percent } from "../../../../utils/mailAudit";

/**
 * A proposed change as the design draws it: blue with `+` to add a label,
 * volcano and struck through to remove one, with its confidence; faded
 * when unticked, so it would not apply.
 */
const ChangeTag: React.FunctionComponent<{
  action: MailAuditAction;
  label: string;
  confidence?: number;
  unticked?: boolean;
}> = ({ action, label, confidence, unticked }) => {
  const style: React.CSSProperties = {
    marginInlineEnd: 4,
    ...(unticked ? { opacity: 0.5 } : {}),
  };
  return action === "add" ? (
    <Tag color={"blue"} style={style}>
      + {label}
      {confidence === undefined ? null : ` · ${percent(confidence)}`}
    </Tag>
  ) : (
    <Tag color={"volcano"} style={style}>
      <span style={{ textDecoration: "line-through" }}>{label}</span>
      {confidence === undefined ? null : ` · ${percent(confidence)}`}
    </Tag>
  );
};

export default ChangeTag;
