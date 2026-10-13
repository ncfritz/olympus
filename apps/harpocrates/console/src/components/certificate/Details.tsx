import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { Button, Flex, message, Segmented, Typography } from "antd";
import { useState } from "react";
import type { DeployTarget, FullCertificate, Issuer } from "@/lib/api/types";
import { derOf, dnsNamesOf } from "@/lib/certificatePage";
import { saveFile } from "@/lib/download";
import { CertificateDetails } from "../CertificateDetails";
import styles from "./Certificate.module.css";

type Pem = "certificate" | "chain" | "issuers";

/**
 * The Details tab: the certificate decoded (fingerprints, key, signature,
 * every extension) beside its PEM (alone, with its chain, or the chain),
 * its files, and the commands to check it from a shell.
 */
export function Details({
  certificate,
  issuer,
  targets,
  fileName,
}: {
  certificate: FullCertificate;
  issuer?: Issuer;
  targets: DeployTarget[];
  fileName: string;
}) {
  const [messages, messageHolder] = message.useMessage();
  const [pem, setPem] = useState<Pem>("certificate");
  const text =
    pem === "certificate"
      ? certificate.certificate
      : pem === "chain"
        ? [certificate.certificate, ...certificate.chain].join("")
        : certificate.chain.join("");
  const endpoint =
    targets[0]?.endpoint ??
    (dnsNamesOf(certificate)[0]
      ? `${dnsNamesOf(certificate)[0].replace(/^\*\./, "www.")}:443`
      : undefined);
  const commands = [
    endpoint && {
      key: "served",
      title: "What its endpoint serves",
      text: `openssl s_client -connect ${endpoint} -status </dev/null 2>/dev/null | openssl x509 -noout -serial -enddate`,
    },
    issuer?.ocspUrl && {
      key: "ocsp",
      title: "Its status from OCSP",
      text: `openssl ocsp -issuer ${fileName}.chain.pem -cert ${fileName}.crt.pem -url ${issuer.ocspUrl} -resp_text -noverify | grep 'Cert Status'`,
    },
    {
      key: "verify",
      title: "That it chains to its root",
      text: `openssl verify -CAfile ${fileName}.chain.pem ${fileName}.crt.pem`,
    },
  ].filter(Boolean) as { key: string; title: string; text: string }[];

  return (
    <div className={styles.split}>
      {messageHolder}
      <section className={styles.box}>
        <Typography.Title level={5} className={styles.boxTitle}>
          Decoded
        </Typography.Title>
        <CertificateDetails
          pem={certificate.certificate}
          nameConstraints={[]}
        />
      </section>
      <section className={styles.box}>
        <Flex justify="space-between" align="center" gap="small" wrap>
          <Typography.Title level={5} className={styles.boxTitle}>
            PEM
          </Typography.Title>
          <Segmented<Pem>
            size="small"
            value={pem}
            onChange={setPem}
            options={[
              { value: "certificate", label: "Certificate" },
              { value: "chain", label: "With its chain" },
              { value: "issuers", label: "Chain only" },
            ]}
          />
        </Flex>
        <pre className={styles.pem}>{text}</pre>
        <Flex gap="small" wrap>
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              void messages.success("Copied");
            }}
          >
            Copy
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() =>
              saveFile(
                `${fileName}.${pem === "certificate" ? "crt" : "chain"}.pem`,
                text,
                "application/x-pem-file",
              )
            }
          >
            .pem
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() =>
              saveFile(
                `${fileName}.der`,
                derOf(certificate.certificate),
                "application/pkix-cert",
              )
            }
          >
            .der
          </Button>
        </Flex>
        <Typography.Title level={5} className={styles.boxTitle}>
          Check it yourself
        </Typography.Title>
        {commands.map((c) => (
          <Flex key={c.key} vertical gap={4}>
            <Typography.Text className={styles.label}>
              {c.title}
            </Typography.Text>
            <Flex gap="small" align="center">
              <code className={`${styles.code} ${styles.grow}`}>{c.text}</code>
              <Typography.Text copyable={{ text: c.text }} />
            </Flex>
          </Flex>
        ))}
      </section>
    </div>
  );
}
