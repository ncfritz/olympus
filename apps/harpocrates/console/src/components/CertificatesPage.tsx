"use client";

import { DownloadOutlined } from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Drawer,
  Flex,
  Input,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
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
      <Typography.Title level={3}>Certificates</Typography.Title>
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
        onClose={() => setOpen(undefined)}
      />
    </Flex>
  );
}

function CertificateDrawer({
  certificateId,
  onClose,
}: {
  certificateId?: string;
  onClose: () => void;
}) {
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
  const [exporting, setExporting] = useState(false);

  return (
    <Drawer
      open={Boolean(certificateId)}
      onClose={() => {
        setExporting(false);
        onClose();
      }}
      size="large"
      title={certificate?.subject ?? "Certificate"}
    >
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
            {certificate.keyLocation === "signer" && isAdmin && !exporting && (
              <Button onClick={() => setExporting(true)}>Export the key</Button>
            )}
          </Flex>
          {exporting && <KeyExportForm certificateId={certificate.id} />}
        </Flex>
      )}
    </Drawer>
  );
}
