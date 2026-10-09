import { MailOutlined } from "@ant-design/icons";
import { Alert, Button, Flex, Form, Input, Modal, Typography } from "antd";
import React, { useState } from "react";
import calendarsApi from "../../../api/calendarsApi";
import { useAuth } from "../../../auth/AuthProvider";
import { apiProblems } from "../../../utils/goals";
import { claimConfirmPage, isEmailAddress } from "../../../utils/calendars";

const { Paragraph, Text } = Typography;

/**
 * Claiming an account the calendar sync already holds (ADR 0028, way 3):
 * the address, then the same answer whatever it was.
 */
const ClaimModal: React.FunctionComponent<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [sending, setSending] = useState(false);

  const close = () => {
    setEmail("");
    setSentTo(undefined);
    setProblem(undefined);
    onClose();
  };

  const send = async () => {
    setSending(true);
    setProblem(undefined);
    try {
      await calendarsApi.claim(
        email.trim(),
        claimConfirmPage(window.location.origin),
      );
      setSentTo(email.trim());
    } catch (error) {
      setProblem(apiProblems(error).join(" "));
    } finally {
      setSending(false);
    }
  };

  const name = auth.status === "signed-in" ? auth.user.displayName : "you";

  return (
    <Modal
      open={open}
      onCancel={close}
      title={sentTo ? "Check that inbox" : "Claim a calendar account"}
      width={520}
      footer={
        sentTo ? (
          <Flex justify={"flex-end"} gap={8}>
            <Button type={"primary"} onClick={close}>
              Done
            </Button>
          </Flex>
        ) : (
          <Flex justify={"flex-end"} gap={8}>
            <Button onClick={close}>Cancel</Button>
            <Button
              type={"primary"}
              disabled={!isEmailAddress(email)}
              loading={sending}
              onClick={send}
            >
              Send link
            </Button>
          </Flex>
        )
      }
    >
      {sentTo ? (
        <Flex gap={16} align={"flex-start"}>
          <MailOutlined
            style={{ fontSize: 22, color: "#1677ff", marginTop: 4 }}
          />
          <div>
            <Paragraph strong={true}>
              If the calendar sync has an unclaimed account for {sentTo}, a link
              is on its way there.
            </Paragraph>
            <ul
              style={{ paddingLeft: 18, margin: 0, color: "rgba(0,0,0,.65)" }}
            >
              <li>Open it in this browser, signed in as {name}.</li>
              <li>It works once, until this time tomorrow.</li>
              <li>
                No email? The account may already be someone&apos;s, or the sync
                doesn&apos;t have it. Connect it instead: signing in to it
                proves it&apos;s yours too.
              </li>
            </ul>
          </div>
        </Flex>
      ) : (
        <>
          <Paragraph type={"secondary"}>
            For an account the calendar sync already has but that isn&apos;t
            linked to you, for example one connected before Olympus had users.
          </Paragraph>
          <Paragraph type={"secondary"}>
            We&apos;ll email a link to the account&apos;s address. Open it while
            signed in here as you, confirm, and the account and its meetings are
            yours.
          </Paragraph>
          <Form layout={"vertical"} onFinish={send}>
            <Form.Item
              label={"The account's email"}
              extra={
                <Text type={"secondary"} style={{ fontSize: 12 }}>
                  Up to five claims a day. The link works once, for 24 hours.
                </Text>
              }
            >
              <Input
                type={"email"}
                value={email}
                autoFocus={true}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Form.Item>
          </Form>
          {problem && <Alert type={"error"} showIcon={true} title={problem} />}
        </>
      )}
    </Modal>
  );
};

export default ClaimModal;
