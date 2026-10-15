import { DownloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Flex,
  Table,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useIssuerOcsp } from "@/lib/api/queries";
import type { FullIssuer, OcspResponder } from "@/lib/api/types";
import { saveFile } from "@/lib/download";
import { formatDate, formatDateTime } from "@/lib/labels";
import { currentResponder, freshness, inService } from "@/lib/ocsp";
import { ErrorAlert } from "./ErrorAlert";
import styles from "./IssuerOcspPanel.module.css";

/**
 * A CA's OCSP (ADR 0036): the responder that signs its responses, those
 * before it, and how fresh its stored responses are. An online CA's
 * responder is the service's to issue and renew; an offline CA's is
 * issued in one of its ceremonies.
 */
export function IssuerOcspPanel({ issuer }: { issuer: FullIssuer }) {
  const { data, error } = useIssuerOcsp(issuer.id);
  if (error) {
    return (
      <div className={styles.head}>
        <ErrorAlert error={error} />
      </div>
    );
  }
  if (!data) return null;
  const current = currentResponder(data.responders);
  const fresh = freshness(data.responses.earliestNextUpdate);

  return (
    <>
      <Flex vertical gap="middle" className={styles.head}>
        {!current &&
          (issuer.offline ? (
            <Alert
              type="info"
              showIcon
              title="No responder in service"
              description="An offline CA's responder is issued in one of its ceremonies, valid as long as its list: open a ceremony and issue it there. Until then nothing answers for what this CA signed, and no certificate it signs may carry its OCSP URL."
            />
          ) : (
            <Alert
              type="info"
              showIcon
              title="No responder in service"
              description="The service issues an online CA's responder on its next scheduler run, and renews it 10 days before it lapses. A sealed signer waits."
            />
          ))}
        <Descriptions
          column={{ xs: 1, md: 2 }}
          size="small"
          bordered
          items={[
            {
              key: "url",
              label: "Answers at",
              children: <span className={styles.url}>{issuer.ocspUrl}</span>,
            },
            {
              key: "responder",
              label: "Responder",
              children: current
                ? `Serial ${current.serial}, until ${formatDateTime(current.notAfter)}`
                : "None in service",
            },
            {
              key: "responses",
              label: "Responses",
              children: `${data.responses.count} stored, ${data.responses.revoked} revoked`,
            },
            {
              key: "freshness",
              label: "Soonest to lapse",
              children: (
                <Flex gap="small" align="center" wrap>
                  <Tag color={fresh.color}>{fresh.label}</Tag>
                  {formatDateTime(data.responses.earliestNextUpdate)}
                </Flex>
              ),
            },
            {
              key: "signed",
              label: "Last signed",
              children: formatDateTime(data.responses.latestThisUpdate),
            },
          ]}
        />
      </Flex>
      <Table<OcspResponder>
        rowKey="id"
        size="small"
        dataSource={data.responders}
        pagination={{
          pageSize: 20,
          size: "small",
          showSizeChanger: false,
          showTotal: (total) => `${total} responders`,
        }}
        columns={[
          {
            title: "Serial",
            dataIndex: "serial",
            ellipsis: true,
            render: (serial: string) => (
              <Typography.Text code>{serial}</Typography.Text>
            ),
          },
          {
            title: "State",
            key: "state",
            render: (_, responder) =>
              inService(responder) ? (
                <Tag color="green">in service</Tag>
              ) : responder.status === "superseded" ? (
                <Tag>superseded</Tag>
              ) : Date.parse(responder.notAfter) <= Date.now() ? (
                <Tag color="red">expired</Tag>
              ) : (
                <Tag color="gold">not yet valid</Tag>
              ),
          },
          {
            title: "Valid from",
            dataIndex: "notBefore",
            render: formatDate,
          },
          {
            title: "Until",
            dataIndex: "notAfter",
            render: formatDateTime,
          },
          {
            title: "Issued",
            key: "issued",
            render: (_, responder) =>
              responder.ceremonyId ? (
                <Link href={`/ceremony?id=${responder.ceremonyId}`}>
                  in a ceremony
                </Link>
              ) : (
                "by the service"
              ),
          },
          {
            title: "",
            key: "download",
            align: "right",
            render: (_, responder) => (
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() =>
                  saveFile(
                    `${issuer.id}-ocsp-${responder.serial}.crt.pem`,
                    responder.certificate,
                    "application/x-pem-file",
                  )
                }
              >
                Certificate
              </Button>
            ),
          },
        ]}
      />
    </>
  );
}
