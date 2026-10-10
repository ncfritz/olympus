"use client";

import { DownloadOutlined } from "@ant-design/icons";
import { Alert, Button, Descriptions, Flex, Result } from "antd";
import { useState } from "react";
import type { FullCertificate } from "@/lib/api/types";
import { saveFile } from "@/lib/download";
import { useCurrentUser } from "@/lib/api/queries";
import { formatDate } from "@/lib/labels";
import { KeyExportForm } from "./KeyExportForm";

/**
 * A certificate just issued or renewed: its files, and, for a key the
 * signer generated, its export. A key that is not escrowed exports once,
 * so the page says so until it has.
 */
export function IssuedCertificate({
  certificate,
  generated,
  escrowed,
  actions,
}: {
  certificate: FullCertificate;
  generated: boolean;
  escrowed: boolean;
  actions?: React.ReactNode[];
}) {
  const [exported, setExported] = useState(false);
  // An escrowed key can be exported any time: the form waits to be asked.
  const [exporting, setExporting] = useState(!escrowed);
  const { isAdmin } = useCurrentUser();
  const pem = (name: string, text: string) =>
    saveFile(name, text, "application/x-pem-file");
  return (
    <Flex vertical gap="large">
      <Result
        status="success"
        title="Issued"
        subTitle={certificate.subject}
        extra={[
          <Button
            key="crt"
            icon={<DownloadOutlined />}
            onClick={() =>
              pem(`${certificate.serial}.crt.pem`, certificate.certificate)
            }
          >
            Certificate
          </Button>,
          <Button
            key="chain"
            icon={<DownloadOutlined />}
            onClick={() =>
              pem(
                `${certificate.serial}.chain.pem`,
                [certificate.certificate, ...certificate.chain].join(""),
              )
            }
          >
            With its chain
          </Button>,
          ...(actions ?? []),
        ]}
      />
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Serial">
          {certificate.serial}
        </Descriptions.Item>
        <Descriptions.Item label="Issuer">
          {certificate.issuerId}
        </Descriptions.Item>
        <Descriptions.Item label="Valid until">
          {formatDate(certificate.notAfter)}
        </Descriptions.Item>
        <Descriptions.Item label="Key">
          {!generated
            ? "The subscriber's: Harpocrates never had it"
            : escrowed
              ? "Generated and escrowed: export it now or later"
              : exported
                ? "Exported, and destroyed in the signer"
                : "Generated, not escrowed: export it now, once"}
        </Descriptions.Item>
      </Descriptions>
      {generated && !exported && (
        <>
          {!escrowed && (
            <Alert
              type="warning"
              showIcon
              title="This is the only chance to take the key"
              description="It is not escrowed: once exported it is destroyed in the signer, and if it is never exported the certificate is useless."
            />
          )}
          {isAdmin && !exporting ? (
            <div>
              <Button onClick={() => setExporting(true)}>Export the key</Button>
            </div>
          ) : isAdmin ? (
            <KeyExportForm
              certificateId={certificate.id}
              exportOnce={!escrowed}
              onExported={() => setExported(true)}
            />
          ) : (
            <Alert
              type="info"
              showIcon
              title="Exporting a key needs a pki-admin"
              description="Ask one to export it from Certificates."
            />
          )}
        </>
      )}
    </Flex>
  );
}
