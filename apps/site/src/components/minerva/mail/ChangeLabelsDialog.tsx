import type { MailAuditChange, MailLabel } from "@ncfritz/olympus-sdk/minerva";
import { message, Modal, Typography } from "antd";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import mailApi from "../../../api/mailApi";
import { useFetch } from "../../../hooks/useFetch";
import { apiProblems } from "../../../utils/goals";
import {
  bulkChanges,
  labelEffects,
  type LabelWants,
  pickerMessages,
  pickerOptions,
  pickerSuggestions,
  RECENT_KEY,
  withRecent,
} from "../../../utils/labelPicker";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
import LabelPicker from "./LabelPicker";

const { Text } = Typography;

export interface ChangeLabelsDialogProps {
  open: boolean;
  /** The selected proposals; their messages are what changes. */
  proposals: MailAuditChange[];
  onClose: () => void;
  /** Batches were started. */
  onApplied: () => void;
}

/**
 * Change labels on a selection by hand, with the label picker in bulk
 * mode; written to Gmail as a batch per mailbox, like applying proposals.
 */
const ChangeLabelsDialog: React.FunctionComponent<ChangeLabelsDialogProps> = ({
  open,
  proposals,
  onClose,
  onApplied,
}) => {
  const [wants, setWants] = useState<LabelWants>({});
  const [created, setCreated] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWants({});
    setCreated([]);
    setRecent(loadFromLocalStorage<string[]>(RECENT_KEY, []));
  }, [open]);

  const [labels] = useFetch<{ open: boolean }, MailLabel[]>({
    dataType: "mail labels",
    params: { open },
    watch: [open],
    default: [],
    validateOptions: (q) => q.open,
    fetchFunction: async () => (await mailApi.listLabels()).data.labels,
  });

  const messages = useMemo(() => pickerMessages(proposals), [proposals]);
  const suggestions = useMemo(() => pickerSuggestions(proposals), [proposals]);
  const options = useMemo(() => pickerOptions(labels), [labels]);
  const effects = labelEffects(messages, wants);
  const affected = new Set(
    [...bulkChanges(messages, wants, labels).values()].flatMap((b) =>
      b.changes.map((c) => c.gmailId),
    ),
  ).size;

  const apply = async () => {
    setBusy(true);
    try {
      let written = 0;
      for (const [accountId, batch] of bulkChanges(messages, wants, labels)) {
        written += (
          await mailApi.applyChanges(accountId, batch.changes, batch.newLabels)
        ).data.batch.messages;
      }
      const picked = effects.filter((e) => e.adding).map((e) => e.label);
      try {
        storeToLocalStorage(RECENT_KEY, withRecent(recent, picked));
      } catch {
        // Recent labels are a convenience; without storage there are none.
      }
      message.success(
        <span>
          Changing labels on {written.toLocaleString()} messages in Gmail.{" "}
          <Link href={"/minerva/mail/changes"}>
            Follow it in the change log
          </Link>
        </span>,
      );
      onApplied();
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      width={640}
      title={`Change labels on ${messages.length.toLocaleString()} message${
        messages.length === 1 ? "" : "s"
      }`}
      okText={
        affected ? `Apply to ${affected.toLocaleString()} in Gmail` : "Apply"
      }
      okButtonProps={{ disabled: affected === 0, loading: busy }}
      onOk={apply}
      onCancel={onClose}
      destroyOnHidden={true}
    >
      <LabelPicker
        messages={messages}
        options={options}
        suggestions={suggestions}
        recent={recent}
        wants={wants}
        onChange={setWants}
        created={created}
        onCreated={setCreated}
      />
      <Text type={"secondary"} style={{ display: "block", marginTop: 12 }}>
        A message changed in Gmail since is left as it is. It can be undone from
        the change log. The proposals stay to review.
      </Text>
    </Modal>
  );
};

export default ChangeLabelsDialog;
