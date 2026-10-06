import { InboxOutlined } from "@ant-design/icons";
import type { MailAccount } from "@ncfritz/olympus-sdk/minerva";
import { Alert, Empty, Flex, message, Space } from "antd";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import mailApi from "../../../api/mailApi";
import MailAccountsCard from "../../../components/minerva/mail/MailAccountsCard";
import MailBreadcrumbs from "../../../components/minerva/mail/MailBreadcrumbs";
import { useFetch } from "../../../hooks/useFetch";
import { apiProblems } from "../../../utils/goals";
import {
  MAIL_LINK_OUTCOME_KEYS,
  type MailLinkOutcome,
  mailLinkOutcome,
  mailReturnTo,
} from "../../../utils/mailAccounts";

/**
 * Mail's inbox: messages with their current and suggested labels (ADR 0030),
 * from docs/plans/email-management phase 5. Until then, the mailboxes and
 * linking them to Gmail (phase 1b).
 */
const MailInboxPage: React.FunctionComponent = () => {
  const router = useRouter();
  const [outcome, setOutcome] = useState<MailLinkOutcome>();

  const [accounts, loading] = useFetch<Record<string, never>, MailAccount[]>({
    dataType: "mail accounts",
    params: {},
    watch: [],
    default: [],
    fetchFunction: async () => (await mailApi.listAccounts()).data.accounts,
  });

  // What Google's sign-in came back with, shown once.
  useEffect(() => {
    if (!router.isReady) return;
    const said = mailLinkOutcome(router.query);
    if (!said) return;
    setOutcome(said);
    const query = { ...router.query };
    for (const key of MAIL_LINK_OUTCOME_KEYS) delete query[key];
    void router.replace({ query }, undefined, { shallow: true });
  }, [router.isReady, router.query, router]);

  const connect = async (account: MailAccount) => {
    try {
      const response = await mailApi.connectAccount(
        account.id,
        mailReturnTo(window.location.origin),
      );
      window.location.assign(response.data.authUrl);
    } catch (error) {
      message.error(apiProblems(error).join(" "));
    }
  };

  return (
    <>
      <MailBreadcrumbs
        trail={[
          <Space key={"page"} size={4}>
            <InboxOutlined />
            <span>Inbox</span>
          </Space>,
        ]}
      />
      <Flex vertical={true} gap={16} style={{ padding: 16, maxWidth: 880 }}>
        {outcome && (
          <Alert
            type={outcome.type}
            showIcon={true}
            closable={true}
            onClose={() => setOutcome(undefined)}
            message={outcome.title}
            description={outcome.description}
          />
        )}
        <MailAccountsCard
          accounts={accounts}
          loading={loading}
          onConnect={connect}
        />
        <Empty description={"Mail's inbox is on its way."} />
      </Flex>
    </>
  );
};

export default MailInboxPage;
