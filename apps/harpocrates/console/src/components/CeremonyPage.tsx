"use client";

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Popconfirm,
  Tabs,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { expectOk, unwrap } from "@/lib/api/errors";
import { KEYS, useCeremony, useIssuer } from "@/lib/api/queries";
import type { RevocationList } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/labels";
import { SIGNS_LABEL, signsOf } from "@/lib/signs";
import { commonName } from "@/lib/tree";
import { CeremonyCaPanel } from "./CeremonyCaPanel";
import { CeremonyLeafPanel } from "./CeremonyLeafPanel";
import { ErrorAlert } from "./ErrorAlert";

/**
 * An open ceremony (ADR 0020, 0032): what its CA signs, offered by its
 * shape; its revocation list; and closing it, which the signer would do
 * on its own after its timeout.
 */
export function CeremonyPage() {
  const ceremonyId = useSearchParams().get("id") ?? undefined;
  const { data: ceremony, error: notFound } = useCeremony(ceremonyId);
  const { data: issuer } = useIssuer(ceremony?.issuerId);
  const { mutate } = useSWRConfig();
  const [list, setList] = useState<RevocationList>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState<"crl" | "close">();

  if (!ceremonyId) return <Alert type="error" title="Which ceremony?" />;
  if (notFound) return <ErrorAlert error={notFound} />;
  if (!ceremony || !issuer) return null;

  const closed = Boolean(ceremony.closedAt);
  const signs = signsOf(issuer);

  const signList = async () => {
    setBusy("crl");
    try {
      const { crl } = unwrap(
        await apiClient.POST("/v1/ceremony/{ceremonyId}/crl", {
          params: { path: { ceremonyId } },
        }),
      );
      setList(crl);
      setError(undefined);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(undefined);
    }
  };

  const close = async () => {
    setBusy("close");
    try {
      expectOk(
        await apiClient.DELETE("/v1/ceremony/{ceremonyId}", {
          params: { path: { ceremonyId } },
        }),
      );
      setError(undefined);
      await Promise.all([
        mutate(KEYS.ceremony(ceremonyId)),
        mutate(KEYS.signer),
      ]);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" wrap gap="middle">
        <Typography.Title level={3}>
          Ceremony: {commonName(issuer.subject)}
        </Typography.Title>
        {closed ? (
          <Tag>Closed</Tag>
        ) : (
          <Popconfirm
            title="Close the ceremony?"
            description="The signer forgets the key. Opening another needs the key file again."
            okText="Close"
            onConfirm={close}
          >
            <Button loading={busy === "close"}>Close the ceremony</Button>
          </Popconfirm>
        )}
      </Flex>
      <Card>
        <Descriptions column={{ xs: 1, md: 2 }} size="small">
          <Descriptions.Item label="CA">
            <Link href={`/ca?id=${issuer.id}`}>{issuer.id}</Link>
          </Descriptions.Item>
          <Descriptions.Item label="Signs">
            {SIGNS_LABEL[signs]}
          </Descriptions.Item>
          <Descriptions.Item label="Opened">
            {formatDateTime(ceremony.openedAt)} by {ceremony.principal}
          </Descriptions.Item>
          <Descriptions.Item label="Closed">
            {formatDateTime(ceremony.closedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Backup">
            {issuer.provedAt
              ? `Proved ${formatDate(issuer.provedAt)}`
              : "Not proved"}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <ErrorAlert error={error} />
      {closed ? (
        <Alert
          type="info"
          showIcon
          title="This ceremony is closed"
          description={
            <Link href={`/ceremonies/new?issuerId=${issuer.id}`}>
              Open another with the key file
            </Link>
          }
        />
      ) : (
        <Card>
          <Tabs
            items={[
              {
                key: "sign",
                label: `Sign ${SIGNS_LABEL[signs]}`,
                children:
                  signs === "leaf" ? (
                    <CeremonyLeafPanel
                      ceremonyId={ceremonyId}
                      organization={issuer.organization}
                    />
                  ) : (
                    <CeremonyCaPanel
                      ceremonyId={ceremonyId}
                      parentId={issuer.id}
                      tier={signs}
                    />
                  ),
              },
              {
                key: "crl",
                label: "Revocation list",
                children: (
                  <Flex vertical gap="middle" align="start">
                    <Typography.Text type="secondary">
                      An offline CA&apos;s list is signed in its ceremonies and
                      lasts 13 months. Its first was signed when this CA&apos;s
                      first ceremony opened; sign another to publish a
                      revocation or before the last one lapses.
                    </Typography.Text>
                    <Button onClick={signList} loading={busy === "crl"}>
                      Sign a new list
                    </Button>
                    {list && (
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="Number">
                          {list.number}
                        </Descriptions.Item>
                        <Descriptions.Item label="Entries">
                          {list.entries}
                        </Descriptions.Item>
                        <Descriptions.Item label="Next update">
                          {formatDate(list.nextUpdate)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Published at">
                          <Typography.Text code>{list.url}</Typography.Text>
                        </Descriptions.Item>
                      </Descriptions>
                    )}
                  </Flex>
                ),
              },
            ]}
          />
        </Card>
      )}
    </Flex>
  );
}
