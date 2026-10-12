"use client";

import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Flex,
  message,
  Modal,
  Segmented,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCurrentUser, useSshCertificates } from "@/lib/api/queries";
import type {
  CertificateState,
  SshCertificate,
  SshCertificateType,
} from "@/lib/api/types";
import { formatDateTime, STATE_COLORS } from "@/lib/labels";
import { SSH_TYPES } from "@/lib/ssh";
import { ErrorAlert } from "../ErrorAlert";
import { IssueSshCertificateForm } from "./IssueSshCertificateForm";
import { SshCertificateDrawer } from "./SshCertificateDrawer";

/**
 * Every SSH certificate (ADR 0035), by type, and who holds a current one;
 * one at a time in a drawer, opened from `?id=`. An admin issues a user
 * certificate for any mapped identity, or a host's first certificate.
 */
export function SshCertificatesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("id") ?? undefined;
  const [messages, messageHolder] = message.useMessage();
  const { isAdmin } = useCurrentUser();
  const [type, setType] = useState<SshCertificateType>();
  const [current, setCurrent] = useState(true);
  const [issuing, setIssuing] = useState<SshCertificateType>();
  const { data, error, isLoading } = useSshCertificates({
    type,
    current: current ? "true" : undefined,
  });
  const show = (id?: string) =>
    router.push(id ? `/ssh/certificates?id=${id}` : "/ssh/certificates");

  return (
    <Flex vertical gap="large">
      {messageHolder}
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Typography.Title level={3}>SSH certificates</Typography.Title>
        {isAdmin && (
          <Flex gap="small" wrap>
            <Button icon={<PlusOutlined />} onClick={() => setIssuing("user")}>
              User certificate
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIssuing("host")}
            >
              Host certificate
            </Button>
          </Flex>
        )}
      </Flex>
      <Typography.Paragraph type="secondary">
        People get their own user certificates on{" "}
        <Link href="/ssh/mine">My SSH certificate</Link>; hosts renew theirs by
        themselves once an admin has issued the first. Revoking one lists it in
        its CA&apos;s KRL at once.
      </Typography.Paragraph>
      <Flex gap="large" wrap align="center">
        <Segmented<SshCertificateType | "all">
          value={type ?? "all"}
          onChange={(value) => setType(value === "all" ? undefined : value)}
          options={[
            { value: "all", label: "All" },
            { value: "user", label: "Users" },
            { value: "host", label: "Hosts" },
          ]}
        />
        <Flex gap="small" align="center">
          <Switch checked={current} onChange={setCurrent} />
          <Typography.Text>Current only</Typography.Text>
        </Flex>
      </Flex>
      <ErrorAlert error={error} />
      <Table<SshCertificate>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data ?? []}
        onRow={(certificate) => ({ onClick: () => show(certificate.id) })}
        pagination={{ pageSize: 50, showSizeChanger: false }}
        columns={[
          {
            title: "Type",
            dataIndex: "type",
            render: (value: SshCertificateType) => SSH_TYPES[value].label,
          },
          {
            title: "Principals",
            dataIndex: "principals",
            render: (principals: string[]) => (
              <Flex gap={4} wrap>
                {principals.map((p) => (
                  <Tag key={p}>{p}</Tag>
                ))}
              </Flex>
            ),
          },
          {
            title: "For",
            key: "for",
            render: (_, c) => c.identity ?? "—",
            ellipsis: true,
          },
          {
            title: "Profile",
            key: "profile",
            render: (_, c) => `${c.profileId} v${c.profileVersion}`,
          },
          { title: "CA", dataIndex: "caId" },
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
      <Modal
        open={Boolean(issuing)}
        title={
          issuing === "host"
            ? "Issue a host certificate"
            : "Issue a user certificate"
        }
        footer={null}
        destroyOnHidden
        onCancel={() => setIssuing(undefined)}
      >
        {issuing && (
          <IssueSshCertificateForm
            type={issuing}
            forWhom="anyone"
            onIssued={(certificate) => {
              setIssuing(undefined);
              void messages.success("Issued");
              show(certificate.id);
            }}
          />
        )}
      </Modal>
      <SshCertificateDrawer
        certificateId={open}
        canRevoke
        onOpen={show}
        onClose={() => show()}
      />
    </Flex>
  );
}
