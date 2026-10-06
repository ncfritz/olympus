import { DownloadOutlined } from "@ant-design/icons";
import type {
  MailAuditAction,
  MailAuditRule,
} from "@ncfritz/olympus-sdk/minerva";
import { Button, message } from "antd";
import React, { useState } from "react";
import mailApi from "../../../../api/mailApi";
import { fileNameOf, saveText } from "../../../../utils/download";

/** Saves the proposed changes `filters` admit as CSV, the change plan. */
const ExportButton: React.FunctionComponent<{
  label?: string;
  action?: MailAuditAction;
  rule?: MailAuditRule;
  minConfidence?: number;
}> = ({ label, action, rule, minConfidence }) => {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const response = await mailApi.exportAuditChanges({
        ...(label ? { label } : {}),
        ...(action ? { action } : {}),
        ...(rule ? { rule } : {}),
        ...(minConfidence ? { minConfidence } : {}),
      });
      saveText(
        String(response.data),
        fileNameOf(
          response.headers?.["content-disposition"] as string | undefined,
          "mail-audit-changes.csv",
        ),
        "text/csv",
      );
    } catch {
      message.error("The changes could not be exported");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button icon={<DownloadOutlined />} loading={busy} onClick={save}>
      Export CSV
    </Button>
  );
};

export default ExportButton;
