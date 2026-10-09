import { ArrowRightOutlined, MergeOutlined } from "@ant-design/icons";
import type {
  MailAccount,
  MailLabelMergePreview,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Button,
  Descriptions,
  List,
  message,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import mailApi from "../../../api/mailApi";
import { apiProblems } from "../../../utils/goals";

const { Text } = Typography;

/**
 * Merging one label into another in Gmail (docs/plans/email-management
 * phase 4): pick the two, see what would happen (messages moved, children
 * renamed or merged, labels deleted once empty), then merge as one batch
 * the change log can undo.
 */
const MergeLabelsDialog: React.FunctionComponent<{
  open: boolean;
  onClose: () => void;
  /** The user labels to choose from, by full name. */
  labels: string[];
  from?: string;
  into?: string;
}> = ({ open, onClose, labels, from: initialFrom, into: initialInto }) => {
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [accountId, setAccountId] = useState<string>();
  const [from, setFrom] = useState(initialFrom);
  const [into, setInto] = useState(initialInto);
  const [preview, setPreview] = useState<MailLabelMergePreview>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrom(initialFrom);
    setInto(initialInto);
    setPreview(undefined);
    void (async () => {
      const list = (await mailApi.listAccounts()).data.accounts;
      setAccounts(list);
      setAccountId((list.find((a) => a.linkedTime) ?? list[0])?.id);
    })();
  }, [open, initialFrom, initialInto]);

  // A new choice needs a new preview.
  useEffect(() => setPreview(undefined), [from, into, accountId]);

  const options = labels.map((l) => ({ value: l, label: l }));

  const look = async () => {
    if (!accountId || !from || !into) return;
    setBusy(true);
    try {
      setPreview(
        (await mailApi.previewMerge(accountId, from, into)).data.preview,
      );
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  const merge = async () => {
    if (!accountId || !from || !into) return;
    setBusy(true);
    try {
      await mailApi.mergeLabels(accountId, from, into);
      message.success(
        <span>
          Merging {from} into {into} in Gmail.{" "}
          <Link href={"/minerva/mail/changes"}>
            Follow it in the change log
          </Link>
        </span>,
      );
      onClose();
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space size={6}>
          <MergeOutlined />
          <span>Merge labels</span>
        </Space>
      }
      width={640}
      footer={[
        <Button key={"cancel"} onClick={onClose}>
          Cancel
        </Button>,
        preview ? (
          <Button
            key={"merge"}
            type={"primary"}
            danger={preview.deletes.length > 0}
            loading={busy}
            onClick={merge}
          >
            Merge in Gmail
          </Button>
        ) : (
          <Button
            key={"preview"}
            type={"primary"}
            disabled={!from || !into || from === into}
            loading={busy}
            onClick={look}
          >
            Preview
          </Button>
        ),
      ]}
    >
      <Space direction={"vertical"} size={12} style={{ width: "100%" }}>
        {accounts.length > 1 && (
          <Select
            style={{ width: "100%" }}
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((a) => ({ value: a.id, label: a.email }))}
          />
        )}
        <Space.Compact style={{ width: "100%" }} block={true}>
          <Select
            showSearch={true}
            placeholder={"Label to merge away"}
            style={{ width: "48%" }}
            value={from}
            onChange={setFrom}
            options={options}
          />
          <Button disabled={true} icon={<ArrowRightOutlined />} />
          <Select
            showSearch={true}
            placeholder={"Label to keep"}
            style={{ width: "48%" }}
            value={into}
            onChange={setInto}
            options={options}
          />
        </Space.Compact>
        {preview && (
          <>
            <Descriptions size={"small"} column={1} bordered={true}>
              <Descriptions.Item label={"Messages moved"}>
                {preview.messages.toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
            {preview.merges.length > 0 && (
              <List
                size={"small"}
                header={<Text strong={true}>Emptied into</Text>}
                dataSource={preview.merges}
                renderItem={(m) => (
                  <List.Item>
                    <Space wrap={true}>
                      <Tag>{m.from}</Tag>
                      <ArrowRightOutlined />
                      <Tag color={"green"}>{m.to}</Tag>
                      <Text type={"secondary"}>
                        {m.messages.toLocaleString()} messages
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
            {preview.renames.length > 0 && (
              <List
                size={"small"}
                header={<Text strong={true}>Renamed</Text>}
                dataSource={preview.renames}
                renderItem={(r) => (
                  <List.Item>
                    <Space wrap={true}>
                      <Tag>{r.from}</Tag>
                      <ArrowRightOutlined />
                      <Tag color={"blue"}>{r.to}</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            )}
            {preview.deletes.length > 0 && (
              <Alert
                type={"warning"}
                showIcon={true}
                message={`Deleted from Gmail once empty: ${preview.deletes.join(", ")}`}
                description={
                  "A label is deleted only when Gmail says it has no mail left; nothing else is deleted. The whole merge can be undone from the change log, which makes the labels again."
                }
              />
            )}
          </>
        )}
      </Space>
    </Modal>
  );
};

export default MergeLabelsDialog;
