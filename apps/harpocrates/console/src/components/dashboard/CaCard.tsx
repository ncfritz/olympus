import { Button, Card, Descriptions, Flex, Tag, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { AuditVerification, Dashboard, Issuer } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/labels";
import { shortCaName } from "@/lib/tree";
import { ErrorAlert } from "../ErrorAlert";

/**
 * The CA itself: its last publication, its audit chain (verified on
 * request: it walks every event), its ceremonies.
 */
export function CaCard({
  ca,
  issuers,
}: {
  ca: Dashboard["ca"];
  issuers: Issuer[];
}) {
  const [verification, setVerification] = useState<AuditVerification>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const name = (id: string) => {
    const issuer = issuers.find((i) => i.id === id);
    return issuer ? shortCaName(issuer) : id;
  };

  const verify = async () => {
    setBusy(true);
    try {
      setVerification(
        unwrap(await apiClient.GET("/v1/audit/verification")).verification,
      );
      setError(undefined);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="The CA">
      <Flex vertical gap="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Last publication">
            {formatDateTime(ca.lastPublishedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Audit chain">
            <Flex gap="small" align="center" wrap>
              {verification ? (
                verification.valid ? (
                  <Tag color="green">
                    Verified, {verification.events.toLocaleString()} events
                  </Tag>
                ) : (
                  <Tag color="red">Broken at {verification.brokenAt}</Tag>
                )
              ) : (
                <Typography.Text>
                  {ca.auditEvents.toLocaleString()} events
                </Typography.Text>
              )}
              <Button size="small" onClick={verify} loading={busy}>
                Verify
              </Button>
            </Flex>
          </Descriptions.Item>
          <Descriptions.Item label="Last ceremony">
            {ca.lastCeremony ? (
              <Link href={`/ceremony?id=${ca.lastCeremony.id}`}>
                {formatDate(ca.lastCeremony.openedAt)},{" "}
                {name(ca.lastCeremony.issuerId)}
              </Link>
            ) : (
              "None yet"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Next ceremony due">
            {ca.nextCeremonyDueAt && ca.nextCeremonyIssuerId ? (
              <span>
                by {formatDate(ca.nextCeremonyDueAt)},{" "}
                <Link href={`/ca?id=${ca.nextCeremonyIssuerId}`}>
                  {name(ca.nextCeremonyIssuerId)}
                </Link>
              </span>
            ) : (
              "—"
            )}
          </Descriptions.Item>
        </Descriptions>
        <ErrorAlert error={error} />
      </Flex>
    </Card>
  );
}
