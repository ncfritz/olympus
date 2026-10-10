"use client";

import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Drawer,
  Flex,
  Input,
  message,
  Segmented,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { useCertificates, useCurrentUser } from "@/lib/api/queries";
import type {
  Certificate,
  CertificateState,
  FullCertificate,
} from "@/lib/api/types";
import { saveFile } from "@/lib/download";
import { formatDate, formatDateTime } from "@/lib/labels";
import { ErrorAlert } from "./ErrorAlert";
import { KeyExportForm } from "./KeyExportForm";
import { RenewForm } from "./RenewForm";
import { RevokeForm } from "./RevokeForm";

const PAGE_SIZE = 50;

const STATE_COLORS: Record<CertificateState, string> = {
  valid: "green",
  revoked: "red",
  expired: "default",
};

const namesOf = (certificate: Certificate) =>
  Object.values(certificate.names ?? {})
    .flat()
    .filter(Boolean)
    .join(", ");

/** Every certificate Harpocrates issued, searchable; one at a time in a drawer. */
export function CertificatesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const issuerId = params.get("issuerId") ?? undefined;
  const [state, setState] = useState<CertificateState>();
  const [search, setSearch] = useState<string>();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string>();
  const { data, error, isLoading } = useCertificates({
    issuerId,
    state,
    search,
    // The service counts pages from 0; the table, from 1.
    startPage: page - 1,
    pageSize: PAGE_SIZE,
  });

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Typography.Title level={3}>Certificates</Typography.Title>
        <Link href="/certificates/new">
          <Button type="primary" icon={<PlusOutlined />}>
            Issue
          </Button>
        </Link>
      </Flex>
      <Flex gap="middle" wrap>
        <Input.Search
          allowClear
          placeholder="Subject or name"
          onSearch={(value) => {
            setSearch(value || undefined);
            setPage(1);
          }}
        />
        <Select<CertificateState>
          allowClear
          placeholder="Any state"
          value={state}
          onChange={(value) => {
            setState(value);
            setPage(1);
          }}
          options={[
            { value: "valid", label: "Valid" },
            { value: "revoked", label: "Revoked" },
            { value: "expired", label: "Expired" },
          ]}
        />
        {issuerId && (
          <Tag closable onClose={() => router.push("/certificates")}>
            Issued by {issuerId}
          </Tag>
        )}
      </Flex>
      <ErrorAlert error={error} />
      <Table<Certificate>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data?.certificates ?? []}
        onRow={(certificate) => ({ onClick: () => setOpen(certificate.id) })}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: data?.count,
          onChange: setPage,
          showSizeChanger: false,
        }}
        columns={[
          { title: "Subject", dataIndex: "subject", ellipsis: true },
          {
            title: "Names",
            key: "names",
            render: (_, c) => namesOf(c),
            ellipsis: true,
          },
          { title: "Profile", dataIndex: "profileId" },
          { title: "Issuer", dataIndex: "issuerId" },
          { title: "Expires", dataIndex: "notAfter", render: formatDate },
          {
            title: "State",
            dataIndex: "state",
            render: (value: CertificateState) => (
              <Tag color={STATE_COLORS[value]}>{value}</Tag>
            ),
          },
        ]}
      />
      <CertificateDrawer
        certificateId={open}
        onOpen={setOpen}
        onClose={() => setOpen(undefined)}
      />
    </Flex>
  );
}

type Action = "renew" | "revoke" | "export";

function CertificateDrawer({
  certificateId,
  onOpen,
  onClose,
}: {
  certificateId?: string;
  /** Another certificate in its place: the renewal just issued. */
  onOpen: (certificateId: string) => void;
  onClose: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const refresh = () =>
    mutate(
      (key) =>
        typeof key === "string" &&
        (key.startsWith("/certificates") || key.startsWith("/certificate/")),
    );
  const { isAdmin } = useCurrentUser();
  const { data: certificate, error } = useSWR<FullCertificate>(
    certificateId ? `/certificate/${certificateId}` : null,
    async () =>
      unwrap(
        await apiClient.GET("/v1/certificate/{certificateId}", {
          params: { path: { certificateId: certificateId! } },
        }),
      ).certificate,
  );
  const [action, setAction] = useState<Action>();
  const valid = certificate?.state === "valid";
  const actions = [
    ...(valid ? [{ value: "renew", label: "Renew" }] : []),
    ...(valid ? [{ value: "revoke", label: "Revoke" }] : []),
    ...(certificate?.keyLocation === "signer" && isAdmin
      ? [{ value: "export", label: "Export the key" }]
      : []),
  ] as { value: Action; label: string }[];

  return (
    <Drawer
      open={Boolean(certificateId)}
      onClose={() => {
        setAction(undefined);
        onClose();
      }}
      size="large"
      title={certificate?.subject ?? "Certificate"}
    >
      {messageHolder}
      <ErrorAlert error={error} />
      {certificate && (
        <Flex vertical gap="large">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Serial">
              {certificate.serial}
            </Descriptions.Item>
            <Descriptions.Item label="Names">
              {namesOf(certificate) || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Profile">
              {certificate.profileId ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Issuer">
              {certificate.issuerId}
            </Descriptions.Item>
            <Descriptions.Item label="Valid">
              {formatDateTime(certificate.notBefore)} –{" "}
              {formatDateTime(certificate.notAfter)}
            </Descriptions.Item>
            <Descriptions.Item label="State">
              <Tag color={STATE_COLORS[certificate.state]}>
                {certificate.state}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Key">
              {certificate.keyAlgorithm}, held by {certificate.keyLocation}
            </Descriptions.Item>
            {certificate.revocation && (
              <Descriptions.Item label="Revoked">
                {formatDateTime(certificate.revocation.revokedAt)} by{" "}
                {certificate.revocation.principal}:{" "}
                {certificate.revocation.reason}
                {certificate.revocation.comment
                  ? ` (${certificate.revocation.comment})`
                  : ""}
              </Descriptions.Item>
            )}
            {certificate.renewsId && (
              <Descriptions.Item label="Renews">
                <Button
                  type="link"
                  size="small"
                  onClick={() => onOpen(certificate.renewsId!)}
                >
                  {certificate.renewsId}
                </Button>
              </Descriptions.Item>
            )}
            {certificate.renewedById && (
              <Descriptions.Item label="Renewed by">
                <Button
                  type="link"
                  size="small"
                  onClick={() => onOpen(certificate.renewedById!)}
                >
                  {certificate.renewedById}
                </Button>
              </Descriptions.Item>
            )}
          </Descriptions>
          <Flex gap="small" wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                saveFile(
                  `${certificate.serial}.crt.pem`,
                  certificate.certificate,
                  "application/x-pem-file",
                )
              }
            >
              Certificate
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                saveFile(
                  `${certificate.serial}.chain.pem`,
                  [certificate.certificate, ...certificate.chain].join(""),
                  "application/x-pem-file",
                )
              }
            >
              With its chain
            </Button>
          </Flex>
          {actions.length > 0 && (
            <Segmented<Action | "none">
              value={action ?? "none"}
              onChange={(value) =>
                setAction(value === "none" ? undefined : value)
              }
              options={[{ value: "none", label: "—" }, ...actions]}
            />
          )}
          {action === "renew" && (
            <RenewForm
              certificate={certificate}
              onRenewed={async (renewal) => {
                await refresh();
                setAction(undefined);
                void messages.success("Renewed");
                onOpen(renewal.id);
              }}
            />
          )}
          {action === "revoke" && (
            <RevokeForm
              certificate={certificate}
              onRevoked={async (revoked) => {
                await refresh();
                setAction(undefined);
                void messages.success(
                  revoked.length > 1
                    ? `Revoked, with ${revoked.length - 1} other certificates for its key`
                    : "Revoked",
                );
              }}
            />
          )}
          {action === "export" && (
            <KeyExportForm certificateId={certificate.id} />
          )}
        </Flex>
      )}
    </Drawer>
  );
}
