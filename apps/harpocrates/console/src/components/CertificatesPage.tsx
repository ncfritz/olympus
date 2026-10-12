"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Input, Select, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useCertificates } from "@/lib/api/queries";
import type { Certificate, CertificateState } from "@/lib/api/types";
import { formatDate, namesOf, STATE_COLORS } from "@/lib/labels";
import { CertificateDrawer } from "./certificates/CertificateDrawer";
import { ErrorAlert } from "./ErrorAlert";

const PAGE_SIZE = 50;

/** Every certificate Harpocrates issued, searchable; one at a time in a drawer. */
export function CertificatesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const issuerId = params.get("issuerId") ?? undefined;
  const [state, setState] = useState<CertificateState>();
  const [search, setSearch] = useState<string>();
  const [page, setPage] = useState(1);
  // A link opens one certificate: ?certificateId=, from a deploy target.
  const [open, setOpen] = useState<string | undefined>(
    params.get("certificateId") ?? undefined,
  );
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
