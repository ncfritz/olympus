"use client";

import { DownloadOutlined } from "@ant-design/icons";
import {
  Button,
  Descriptions,
  Drawer,
  Flex,
  message,
  Segmented,
  Tag,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { KEYS, useCurrentUser } from "@/lib/api/queries";
import type { FullCertificate } from "@/lib/api/types";
import { saveFile } from "@/lib/download";
import { formatDateTime, namesOf, STATE_COLORS } from "@/lib/labels";
import { DeployTargetForm } from "../DeployTargetForm";
import { ErrorAlert } from "../ErrorAlert";
import { KeyExportForm } from "../KeyExportForm";
import { RenewForm } from "../RenewForm";
import { RevokeForm } from "../RevokeForm";

type Action = "renew" | "revoke" | "export" | "deploy";

/**
 * One certificate: its details, its downloads, and what can be done with
 * it (renew, revoke, export its key, deploy it).
 */
export function CertificateDrawer({
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
        (key.startsWith("/certificates") ||
          key.startsWith("/certificate/") ||
          key === KEYS.lineages),
    );
  const { isAdmin } = useCurrentUser();
  const router = useRouter();
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
    ...(valid && certificate?.keyLocation === "signer" && isAdmin
      ? [{ value: "deploy", label: "Deploy" }]
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
          {action === "deploy" && (
            <DeployTargetForm
              certificate={certificate}
              onCreated={(target) =>
                router.push(`/deploy-targets?id=${target.id}`)
              }
            />
          )}
        </Flex>
      )}
    </Drawer>
  );
}
