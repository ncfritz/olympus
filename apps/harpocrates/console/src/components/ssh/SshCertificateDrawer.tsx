"use client";

import {
  Button,
  Descriptions,
  Drawer,
  Flex,
  message,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { isSshCertificateKey, useSshCertificate } from "@/lib/api/queries";
import { formatDateTime, STATE_COLORS } from "@/lib/labels";
import { SSH_TYPES } from "@/lib/ssh";
import { ErrorAlert } from "../ErrorAlert";
import { SshCertificateFile } from "./SshCertificateFile";
import { SshCertificateView } from "./SshCertificateView";
import { SshRevokeForm } from "./SshRevokeForm";

/** One SSH certificate: what it says, its file, and revoking it. */
export function SshCertificateDrawer({
  certificateId,
  canRevoke,
  onOpen,
  onClose,
}: {
  certificateId?: string;
  canRevoke: boolean;
  /** Another certificate in its place: the one it renews. */
  onOpen: (certificateId: string) => void;
  onClose: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [messages, messageHolder] = message.useMessage();
  const { data: certificate, error } = useSshCertificate(certificateId);
  const [revoking, setRevoking] = useState(false);

  return (
    <Drawer
      open={Boolean(certificateId)}
      onClose={() => {
        setRevoking(false);
        onClose();
      }}
      size="large"
      title={
        certificate
          ? `${SSH_TYPES[certificate.type].label} certificate: ${certificate.principals.join(", ")}`
          : "SSH certificate"
      }
    >
      {messageHolder}
      <ErrorAlert error={error} />
      {certificate && (
        <Flex vertical gap="large">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="State">
              <Tag color={STATE_COLORS[certificate.state]}>
                {certificate.state}
              </Tag>
              {certificate.revokedAt &&
                `${formatDateTime(certificate.revokedAt)}, ${certificate.revocationReason}`}
            </Descriptions.Item>
            {certificate.identity && (
              <Descriptions.Item label="For">
                {certificate.identity}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Profile">
              {certificate.profileId} v{certificate.profileVersion}
            </Descriptions.Item>
            <Descriptions.Item label="CA">{certificate.caId}</Descriptions.Item>
            <Descriptions.Item label="Key">
              {certificate.keyAlgorithm},{" "}
              <Typography.Text code>{certificate.fingerprint}</Typography.Text>
            </Descriptions.Item>
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
            <Descriptions.Item label="Issued">
              {formatDateTime(certificate.createdAt)}
            </Descriptions.Item>
          </Descriptions>
          <SshCertificateFile
            certificate={certificate.certificate}
            contents={certificate.contents}
          />
          <Typography.Title level={5}>What it says</Typography.Title>
          <SshCertificateView contents={certificate.contents} />
          {canRevoke && certificate.state === "valid" && (
            <>
              {!revoking && (
                <div>
                  <Button danger onClick={() => setRevoking(true)}>
                    Revoke
                  </Button>
                </div>
              )}
              {revoking && (
                <SshRevokeForm
                  certificate={certificate}
                  onRevoked={async () => {
                    await mutate(isSshCertificateKey);
                    setRevoking(false);
                    void messages.success("Revoked: its CA's KRL lists it now");
                  }}
                />
              )}
            </>
          )}
        </Flex>
      )}
    </Drawer>
  );
}
