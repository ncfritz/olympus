"use client";

import { Alert, Card, Descriptions, Flex, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { useMySsh } from "@/lib/api/queries";
import type { CertificateState, SshCertificate } from "@/lib/api/types";
import { formatDateTime, STATE_COLORS } from "@/lib/labels";
import { ErrorAlert } from "../ErrorAlert";
import { IssueSshCertificateForm } from "./IssueSshCertificateForm";
import { SshCertificateFile } from "./SshCertificateFile";
import { SshCertificateView } from "./SshCertificateView";

/**
 * One's own SSH certificate (ADR 0035), for anyone signed in: whom one may
 * log in as, a certificate for one's own key, and the line that makes
 * one's machine trust the hosts. No PKI role is needed.
 */
export function MySshPage() {
  const { data, error, isLoading } = useMySsh();
  const [issued, setIssued] = useState<SshCertificate>();

  return (
    <Flex vertical gap="large">
      <Typography.Title level={3}>My SSH certificate</Typography.Title>
      <Typography.Paragraph type="secondary">
        A certificate for your own SSH key logs you in to every host that trusts
        Harpocrates&apos;s user CA, as the accounts you are mapped to, for a
        working day. Ask for another when it runs out: the same key is certified
        again.
      </Typography.Paragraph>
      <ErrorAlert error={error} />
      {data && (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Signed in as">
              {data.identity}
            </Descriptions.Item>
            <Descriptions.Item label="May log in as">
              {data.principals.length ? (
                <Flex gap={4} wrap>
                  {data.principals.map((p) => (
                    <Tag key={p}>{p}</Tag>
                  ))}
                </Flex>
              ) : (
                "No one: an admin maps you to accounts first"
              )}
            </Descriptions.Item>
          </Descriptions>
          {data.principals.length > 0 && (
            <Card size="small" title="Get a certificate">
              <IssueSshCertificateForm
                type="user"
                forWhom="self"
                ownPrincipals={data.principals}
                onIssued={setIssued}
              />
            </Card>
          )}
          {issued && (
            <Card size="small" title="Your certificate">
              <Flex vertical gap="middle">
                <Alert
                  type="success"
                  showIcon
                  title={`Valid until ${formatDateTime(issued.validBefore)}`}
                  description="Save it beside your key. ssh -v shows it offered as a certificate; ssh-add adds it to your agent with the key."
                />
                <SshCertificateFile
                  certificate={issued.certificate}
                  contents={issued.contents}
                />
                <SshCertificateView contents={issued.contents} />
              </Flex>
            </Card>
          )}
          {data.hostTrustLines.length > 0 && (
            <Card size="small" title="Trusting the hosts">
              <Flex vertical gap="small">
                <Typography.Text>
                  {data.hostTrustLines.length > 1 ? "These lines" : "This line"}{" "}
                  in <Typography.Text code>~/.ssh/known_hosts</Typography.Text>{" "}
                  trust every host Harpocrates vouches for, with no host-key
                  prompt:
                </Typography.Text>
                {data.hostTrustLines.map((line) => (
                  <Typography.Paragraph
                    key={line}
                    code
                    copyable={{ text: line }}
                  >
                    {line}
                  </Typography.Paragraph>
                ))}
              </Flex>
            </Card>
          )}
          <Typography.Title level={5}>Your certificates</Typography.Title>
          <Table<SshCertificate>
            rowKey="id"
            size="small"
            loading={isLoading}
            dataSource={data.certificates}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            columns={[
              {
                title: "Issued",
                dataIndex: "createdAt",
                render: formatDateTime,
              },
              {
                title: "Logs in as",
                dataIndex: "principals",
                render: (principals: string[]) => principals.join(", "),
              },
              {
                title: "Key",
                dataIndex: "fingerprint",
                ellipsis: true,
                render: (value: string) => (
                  <Typography.Text code>{value}</Typography.Text>
                ),
              },
              {
                title: "Valid until",
                dataIndex: "validBefore",
                render: formatDateTime,
              },
              {
                title: "State",
                dataIndex: "state",
                render: (value: CertificateState) => (
                  <Tag color={STATE_COLORS[value]}>{value}</Tag>
                ),
              },
            ]}
          />
        </>
      )}
    </Flex>
  );
}
