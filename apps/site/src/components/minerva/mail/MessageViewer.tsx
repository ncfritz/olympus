import { ExportOutlined, PaperClipOutlined } from "@ant-design/icons";
import type {
  MailMessageAddress,
  MailMessageContent,
} from "@ncfritz/olympus-sdk/minerva";
import {
  Alert,
  Descriptions,
  Modal,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import mailApi from "../../../api/mailApi";
import { apiProblems } from "../../../utils/goals";
import { gmailLink } from "../../../utils/mailAudit";
import { containedHtml } from "../../../utils/mailInbox";

const { Text } = Typography;

const address = (a: MailMessageAddress) =>
  a.name ? `${a.name} <${a.address}>` : a.address;

const kilobytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : `${Math.round(bytes / 1024).toLocaleString()} KB`;

export interface MessageViewerProps {
  /** The message to show; nothing is open without one. */
  message?: { accountId: string; gmailId: string; subject?: string };
  onClose: () => void;
}

/**
 * A message read live from Gmail and shown once (docs/plans/
 * email-management phase 5; ADR 0030): its headers, its body and what is
 * attached. The HTML is shown in a frame that runs no script and loads
 * nothing remote; nothing of the message is kept once this closes.
 */
const MessageViewer: React.FunctionComponent<MessageViewerProps> = ({
  message,
  onClose,
}) => {
  const [content, setContent] = useState<MailMessageContent>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    setContent(undefined);
    setProblem(undefined);
    if (!message) return;
    let current = true;
    mailApi
      .getMessageContent(message.accountId, message.gmailId)
      .then((response) => {
        if (current) setContent(response.data.content);
      })
      .catch((error: unknown) => {
        if (current) setProblem(apiProblems(error).join(" "));
      });
    return () => {
      current = false;
    };
  }, [message?.accountId, message?.gmailId]);

  return (
    <Modal
      open={message !== undefined}
      onCancel={onClose}
      footer={null}
      width={920}
      destroyOnHidden={true}
      title={
        <Space>
          <span>{content?.subject ?? message?.subject ?? "(no subject)"}</span>
          {message && (
            <a
              href={gmailLink(message.gmailId)}
              target={"_blank"}
              rel={"noreferrer"}
              style={{ fontSize: 13, fontWeight: 400 }}
            >
              Open in Gmail <ExportOutlined />
            </a>
          )}
        </Space>
      }
    >
      {problem ? (
        <Alert type={"error"} showIcon={true} message={problem} />
      ) : !content ? (
        <Skeleton active={true} paragraph={{ rows: 8 }} />
      ) : (
        <Space direction={"vertical"} style={{ width: "100%" }} size={12}>
          <Descriptions size={"small"} column={1} bordered={true}>
            {content.from && (
              <Descriptions.Item label={"From"}>
                {address(content.from)}
              </Descriptions.Item>
            )}
            {content.to.length > 0 && (
              <Descriptions.Item label={"To"}>
                {content.to.map(address).join(", ")}
              </Descriptions.Item>
            )}
            {content.cc.length > 0 && (
              <Descriptions.Item label={"Cc"}>
                {content.cc.map(address).join(", ")}
              </Descriptions.Item>
            )}
            {content.replyTo.length > 0 && (
              <Descriptions.Item label={"Reply-To"}>
                {content.replyTo.map(address).join(", ")}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={"Received"}>
              {DateTime.fromISO(content.receivedTime).toLocaleString(
                DateTime.DATETIME_MED,
              )}
            </Descriptions.Item>
          </Descriptions>
          {content.attachments.some((a) => !a.inline) && (
            <Space size={[6, 6]} wrap={true}>
              {content.attachments
                .filter((a) => !a.inline)
                .map((a, i) => (
                  <Tag key={`${a.filename ?? a.mimeType}-${i}`}>
                    <PaperClipOutlined /> {a.filename ?? a.mimeType} ·{" "}
                    {kilobytes(a.sizeBytes)}
                  </Tag>
                ))}
            </Space>
          )}
          {content.truncated && (
            <Alert
              type={"info"}
              showIcon={true}
              message={
                "This message is long: it is cut short here. Gmail has all of it."
              }
            />
          )}
          <Tabs
            items={[
              ...(content.html
                ? [
                    {
                      key: "html",
                      label: "Message",
                      children: (
                        <iframe
                          title={"Message"}
                          // No scripts, forms or same-origin access; links
                          // open in a new tab, outside the frame.
                          sandbox={
                            "allow-popups allow-popups-to-escape-sandbox"
                          }
                          referrerPolicy={"no-referrer"}
                          srcDoc={containedHtml(content.html)}
                          style={{
                            width: "100%",
                            height: "60vh",
                            border: "1px solid #f0f0f0",
                          }}
                        />
                      ),
                    },
                  ]
                : []),
              {
                key: "text",
                label: content.html ? "Plain text" : "Message",
                children: (
                  <Text>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        maxHeight: "60vh",
                        overflow: "auto",
                        fontFamily: "inherit",
                        margin: 0,
                      }}
                    >
                      {content.text || "(no text)"}
                    </pre>
                  </Text>
                ),
              },
            ]}
          />
          <Text type={"secondary"} style={{ fontSize: 12 }}>
            Read from Gmail just now. Images and other remote content are not
            loaded; nothing of the message is kept.
          </Text>
        </Space>
      )}
    </Modal>
  );
};

export default MessageViewer;
