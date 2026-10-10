"use client";

import { UndoOutlined } from "@ant-design/icons";
import { Alert, Button, Flex, Table, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import type {
  IssuerTier,
  NameConstraints,
  PreviewIssuerResponse,
} from "@/lib/api/types";
import type { CaFormValues } from "@/lib/caRequest";
import { describeDays, ekuName, formatDate } from "@/lib/labels";

/** A form field the operator may put back to its default. */
export type ResettableField = keyof CaFormValues;

interface Row {
  key: string;
  setting: string;
  value: ReactNode;
  byDefault: ReactNode;
  why: string;
  changed: boolean;
  /** The form fields a reset clears; none: not a setting, an invariant. */
  reset?: ResettableField[];
}

const KEY_USAGE_NAMES: Record<string, string> = {
  digital_signature: "digitalSignature",
  key_cert_sign: "keyCertSign",
  crl_sign: "cRLSign",
};

const VALIDITY_WHY: Record<IssuerTier, string> = {
  root: "20 years: a root outlives everything beneath it and is replaced rarely, since every device trusts it by hand.",
  intermediate:
    "10 years, never past its root: long enough to outlive the issuing CAs it signs.",
  issuing:
    "5 years, never past its parent: online keys are replaced more often than offline ones.",
};

const constraintsText = (constraints: NameConstraints | undefined) => {
  if (!constraints) return "None";
  const part = (label: string, names?: Record<string, string[] | undefined>) =>
    Object.entries(names ?? {})
      .filter(([, values]) => values?.length)
      .map(([type, values]) => `${label} ${type}: ${values!.join(", ")}`);
  const lines = [
    ...part("permitted", constraints.permitted),
    ...part("excluded", constraints.excluded),
  ];
  return lines.length ? lines.join("; ") : "None";
};

const ekuText = (oids: string[]) =>
  oids.length ? oids.map(ekuName).join(", ") : "Not restricted";

/**
 * Every setting of a CA before it is signed (ADR 0032, Names and
 * settings): its value, its default and the reason for the default. A
 * changed row is marked and can be put back; the invariants are listed
 * too, so the review is of the whole certificate.
 */
export function SettingsReview({
  tier,
  answer,
  onReset,
}: {
  tier: IssuerTier;
  answer: PreviewIssuerResponse;
  onReset?: (fields: ResettableField[]) => void;
}) {
  const { preview: p, defaults: d } = answer;
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const rows: Row[] = [
    {
      key: "subject",
      setting: "Subject",
      value: <Typography.Text code>{p.subject}</Typography.Text>,
      byDefault: <Typography.Text code>{d.subject}</Typography.Text>,
      why: "Built from the organisation, purpose, tier, number and generation (ADR 0020, Naming). A subject is never used twice.",
      changed: !same(p.subject, d.subject),
      reset: ["customSubject", "subject", "organization"],
    },
    {
      key: "organization",
      setting: "Organisation",
      value: p.organization,
      byDefault: d.organization,
      why:
        tier === "root"
          ? "O, and the start of the CN. Everything beneath this root takes it."
          : "Its root's: one organisation per hierarchy.",
      changed: !same(p.organization, d.organization),
      reset: ["organization"],
    },
    {
      key: "validity",
      setting: "Validity",
      value: `${describeDays(p.validityDays)} (until ${formatDate(p.notAfter)})`,
      byDefault: `${describeDays(d.validityDays)} (until ${formatDate(d.notAfter)})`,
      why: VALIDITY_WHY[tier],
      changed: p.validityDays !== d.validityDays,
      reset: ["validityDays"],
    },
    {
      key: "algorithm",
      setting: "Key",
      value: `${p.algorithm}${p.algorithm === "P-256" ? ", ecdsa-with-SHA256" : ", sha256WithRSAEncryption"}`,
      byDefault: `${d.algorithm}, ecdsa-with-SHA256`,
      why: "P-256: small keys and signatures, and accepted by everything here. RSA only for a relying party that needs it.",
      changed: p.algorithm !== d.algorithm,
      reset: ["algorithm"],
    },
    {
      key: "nameConstraints",
      setting: "Name constraints",
      value: constraintsText(p.nameConstraints),
      byDefault: constraintsText(d.nameConstraints),
      why: "None by default. Set, every name beneath this CA must fall within them, checked by the signer.",
      changed: !same(p.nameConstraints, d.nameConstraints),
      reset: [
        "permittedDns",
        "excludedDns",
        "permittedEmail",
        "permittedIp",
        "excludedIp",
      ],
    },
    ...(tier === "issuing"
      ? [
          {
            key: "extendedKeyUsages",
            setting: "Extended key usages it signs",
            value: ekuText(p.extendedKeyUsages),
            byDefault: ekuText(d.extendedKeyUsages),
            why: "What the profiles of its purpose need. Written into its certificate; the signer refuses anything else.",
            changed: !same(p.extendedKeyUsages, d.extendedKeyUsages),
            reset: ["extendedKeyUsages"] as ResettableField[],
          },
          {
            key: "maxValidityDays",
            setting: "Longest certificate it signs",
            value: describeDays(p.maxValidityDays),
            byDefault: describeDays(d.maxValidityDays),
            why: "The longest profile of its purpose. It stops issuing once that no longer fits in its remaining life.",
            changed: p.maxValidityDays !== d.maxValidityDays,
            reset: ["maxValidityDays"] as ResettableField[],
          },
        ]
      : [
          {
            key: "maxValidityDays",
            setting: "Longest certificate it signs",
            value: describeDays(p.maxValidityDays),
            byDefault: describeDays(d.maxValidityDays),
            why: "What sits below it: an offline CA signs the tier beneath, and stops when that no longer fits.",
            changed: false,
          },
        ]),
    {
      key: "pathLength",
      setting: "Path length",
      value: String(p.pathLength),
      byDefault: String(d.pathLength),
      why:
        tier === "root"
          ? "From the root's shape: how many tiers of CAs may sit below it."
          : "One less than its parent's. Not a setting: the signer refuses anything else.",
      changed: false,
    },
    {
      key: "keyUsages",
      setting: "Key usage",
      value: p.keyUsages.map((u) => KEY_USAGE_NAMES[u] ?? u).join(", "),
      byDefault: d.keyUsages.map((u) => KEY_USAGE_NAMES[u] ?? u).join(", "),
      why: "A CA signs certificates and revocation lists. Not a setting.",
      changed: false,
    },
    {
      key: "urls",
      setting: "Published at",
      value: (
        <Flex vertical>
          <Typography.Text code>{p.caIssuersUrl}</Typography.Text>
          <Typography.Text code>{p.crlUrl}</Typography.Text>
        </Flex>
      ),
      byDefault: "",
      why: "Its certificate and its revocation list, on the distribution host.",
      changed: false,
    },
    ...(p.crlDistributionPoint
      ? [
          {
            key: "parent",
            setting: "Checked against",
            value: (
              <Flex vertical>
                <Typography.Text code>{p.issuerUrl}</Typography.Text>
                <Typography.Text code>{p.crlDistributionPoint}</Typography.Text>
              </Flex>
            ),
            byDefault: "",
            why: "Its parent's certificate and list, written into it so relying parties can check it.",
            changed: false,
          },
        ]
      : []),
    {
      key: "crlValidity",
      setting: "Its revocation list",
      value: tier === "issuing" ? "7 days, re-signed daily" : "13 months",
      byDefault: "",
      why:
        tier === "issuing"
          ? "Re-signed by the scheduler, and on every revocation."
          : "Signed in a ceremony, so it lasts until the next one is due.",
      changed: false,
    },
  ];

  return (
    <Flex vertical gap="middle">
      {answer.problems.length > 0 && (
        <Alert
          type="error"
          showIcon
          title="Creating it would be refused"
          description={
            <ul>
              {answer.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          }
        />
      )}
      <Table<Row>
        size="small"
        pagination={false}
        rowKey="key"
        dataSource={rows}
        columns={[
          {
            title: "Setting",
            dataIndex: "setting",
            render: (setting: string, row) => (
              <Flex vertical gap={4} align="start">
                <Typography.Text strong>{setting}</Typography.Text>
                {row.changed && <Tag color="blue">Changed</Tag>}
                {!row.reset && <Tag>Fixed</Tag>}
              </Flex>
            ),
          },
          { title: "Value", dataIndex: "value" },
          {
            title: "Default",
            dataIndex: "byDefault",
            render: (byDefault: ReactNode, row) =>
              row.changed ? (
                byDefault
              ) : (
                <Typography.Text type="secondary">Same</Typography.Text>
              ),
          },
          {
            title: "Why",
            dataIndex: "why",
            render: (why: string) => (
              <Typography.Text type="secondary">{why}</Typography.Text>
            ),
          },
          {
            title: "",
            key: "reset",
            render: (_, row) =>
              row.changed && row.reset && onReset ? (
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={() => onReset(row.reset!)}
                >
                  Reset
                </Button>
              ) : null,
          },
        ]}
      />
    </Flex>
  );
}
