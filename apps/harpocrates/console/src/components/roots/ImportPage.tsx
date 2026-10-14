"use client";

import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Radio,
  Result,
  Row,
  Select,
  Switch,
  Table,
  Tabs,
  Typography,
} from "antd";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import {
  KEYS,
  useCurrentUser,
  useIssuers,
  useProfiles,
} from "@/lib/api/queries";
import type {
  ImportCertificatesResponse,
  Issuer,
  IssuerTier,
  KeyImportFormat,
  RevocationList,
  SkippedCertificate,
} from "@/lib/api/types";
import { EKU_NAMES, TIERS } from "@/lib/labels";
import {
  numberingOf,
  readCaCertificate,
  readCrlIssuer,
  slugOf,
} from "@/lib/pem";
import { commonName, shortCaName } from "@/lib/tree";
import { ErrorAlert } from "../ErrorAlert";
import { ImportKeyInput } from "../ImportKeyInput";
import { PemInput } from "../PemInput";
import styles from "./Roots.module.css";
import { RecentSignInNotice } from "../RecentSignIn";

/** The longest certificate an imported issuing CA signs, by default. */
const ISSUING_MAX_VALIDITY_DAYS = 825;

/** The import's tabs, by `?what=`. */
const WHATS = ["ca", "crl", "certificates"] as const;
type What = (typeof WHATS)[number];

/** Everything the service and the shell keep about the CAs and their certificates. */
const REFRESHED = (key: unknown) =>
  typeof key === "string" &&
  (key === KEYS.issuers ||
    key === KEYS.dashboard ||
    key === KEYS.lineages ||
    key.startsWith("/issuer/") ||
    key.startsWith("/certificates"));

/** A CA, as the selects name it: its name, and its ID beneath. */
const caOption = (issuer: Issuer) => ({
  value: issuer.id,
  label: `${shortCaName(issuer)} (${issuer.id})`,
});

/** The CA whose name a certificate or list gives as its issuer, if one is here. */
const byName = (issuers: Issuer[], name: string | undefined) =>
  name
    ? issuers.find((issuer) => commonName(issuer.subject) === name)
    : undefined;

/**
 * Importing what another CA made (ADR 0037): XCA's CAs, parents first,
 * their newest lists, and what they issued, each a tab. Files are dropped,
 * chosen or pasted. A CA imported leads to its list, then its
 * certificates.
 */
export function ImportPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin } = useCurrentUser();
  const what: What = WHATS.find((w) => w === params.get("what")) ?? "ca";
  const issuerId = params.get("issuerId") ?? undefined;
  const go = (next: What, id?: string) =>
    router.replace(
      `${pathname}?what=${next}${id ? `&issuerId=${encodeURIComponent(id)}` : ""}`,
    );

  return (
    <Flex vertical>
      <Flex
        justify="space-between"
        align="center"
        wrap
        gap="middle"
        className={styles.header}
      >
        <div>
          <Typography.Title level={3} className={styles.title}>
            Import
          </Typography.Title>
          <Typography.Text type="secondary">
            CAs made elsewhere (XCA), kept as a record and to revoke them as
            they are replaced: the root first, then each CA beneath it, its
            newest list, and what it issued.
          </Typography.Text>
        </div>
        <Link href="/roots">
          <Button icon={<ArrowLeftOutlined />}>Roots</Button>
        </Link>
      </Flex>
      <div className={styles.notice}>
        <RecentSignInNotice doing="Importing a CA" />
      </div>
      {!isAdmin && (
        <Alert
          type="info"
          showIcon
          banner
          title="Importing needs the PKI admin role."
        />
      )}
      <Tabs
        className={styles.tabs}
        activeKey={what}
        onChange={(key) => go(key as What, issuerId)}
        items={[
          {
            key: "ca",
            label: "A CA",
            children: (
              <ImportCa
                onImported={(id, tier) =>
                  go(tier === "issuing" ? "crl" : "ca", id)
                }
              />
            ),
          },
          {
            key: "crl",
            label: "Its revocation list",
            children: (
              <ImportCrl
                key={issuerId}
                issuerId={issuerId}
                onImported={(id) => go("certificates", id)}
              />
            ),
          },
          {
            key: "certificates",
            label: "What it issued",
            children: <ImportCertificates key={issuerId} />,
          },
        ]}
      />
    </Flex>
  );
}

type CaValues = {
  certificate?: string;
  parentId?: string;
  tier: IssuerTier;
  id: string;
  number: number;
  generation: number;
  purpose?: string;
  privateKey?: string;
  passphrase?: string;
  maxValidityDays: number;
  extendedKeyUsages: string[];
  closed: boolean;
};

/**
 * A CA: its certificate first, which fills in the rest (its tier, a slug
 * for its ID, its number and generation, its parent if that is here);
 * for an issuing CA, its key and passphrase, and whether it is closed.
 */
function ImportCa({
  onImported,
}: {
  onImported: (id: string, tier: IssuerTier) => void;
}) {
  const [form] = Form.useForm<CaValues>();
  const { mutate } = useSWRConfig();
  const { data: all } = useIssuers();
  const { isAdmin } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [imported, setImported] = useState<{ id: string; tier: IssuerTier }>();
  const issuers = useMemo(
    () => (all ?? []).filter((i) => !i.discardedAt && i.tier !== "issuing"),
    [all],
  );
  const certificate = Form.useWatch("certificate", form);
  const tier = Form.useWatch("tier", form);
  const read = useMemo(
    () => (certificate ? readCaCertificate(certificate) : undefined),
    [certificate],
  );

  /** What the certificate says, into each field not yet touched. */
  const fill = (pem: string | undefined) => {
    const ca = pem ? readCaCertificate(pem) : undefined;
    if (!ca) return;
    const untouched = (name: keyof CaValues) => !form.isFieldTouched(name);
    const guessed: Partial<CaValues> = {
      tier: ca.selfSigned
        ? "root"
        : ca.pathLength === 0
          ? "issuing"
          : "intermediate",
      id: slugOf(ca.commonName),
      parentId: ca.selfSigned ? undefined : byName(issuers, ca.issuerName)?.id,
      ...numberingOf(ca.commonName),
      ...(ca.extendedKeyUsages.length
        ? { extendedKeyUsages: ca.extendedKeyUsages }
        : {}),
    };
    form.setFieldsValue(
      Object.fromEntries(
        Object.entries(guessed).filter(([name]) =>
          untouched(name as keyof CaValues),
        ),
      ),
    );
  };

  const submit = async (values: CaValues) => {
    setBusy(true);
    setError(undefined);
    try {
      const parent = values.parentId
        ? unwrap(
            await apiClient.GET("/v1/issuer/{issuerId}", {
              params: { path: { issuerId: values.parentId } },
            }),
          ).issuer
        : undefined;
      const chain =
        values.tier === "root" || !parent?.certificate
          ? []
          : [parent.certificate, ...parent.chain];
      const issuing = values.tier === "issuing";
      unwrap(
        await apiClient.POST("/v1/issuers/import", {
          body: {
            id: values.id,
            certificate: values.certificate!,
            chain,
            tier: values.tier,
            purpose: issuing ? values.purpose : undefined,
            number: values.number,
            generation: values.generation,
            // The field is shown for an issuing CA only, and a form leaves
            // out what it does not show. An offline CA's is set by the
            // service from its tier, whatever is sent; the API still
            // requires one, so it gets the issuing default.
            maxValidityDays: issuing
              ? values.maxValidityDays
              : ISSUING_MAX_VALIDITY_DAYS,
            extendedKeyUsages: issuing ? values.extendedKeyUsages : [],
            privateKey: issuing ? values.privateKey : undefined,
            passphrase: issuing ? values.passphrase : undefined,
            closed: issuing ? values.closed : undefined,
          },
        }),
      );
      await mutate(REFRESHED);
      setImported({ id: values.id, tier: values.tier });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  if (imported) {
    return (
      <Result
        status="success"
        title={`Imported ${imported.id}`}
        subTitle={
          imported.tier === "issuing"
            ? "Next its newest list from XCA, so its numbers continue, then what it issued."
            : "Next the CAs it signed, each with its parent here; then their lists."
        }
        extra={[
          imported.tier === "issuing" ? (
            <Button
              key="next"
              type="primary"
              onClick={() => onImported(imported.id, imported.tier)}
            >
              Import its list
            </Button>
          ) : (
            <Button
              key="next"
              type="primary"
              onClick={() => {
                form.resetFields();
                setImported(undefined);
              }}
            >
              Import a CA beneath it
            </Button>
          ),
          <Link key="open" href={`/ca?id=${imported.id}`}>
            <Button>Open it</Button>
          </Link>,
        ]}
      />
    );
  }

  return (
    <Form<CaValues>
      form={form}
      layout="vertical"
      className={styles.padded}
      disabled={!isAdmin}
      initialValues={{
        tier: "issuing",
        number: 1,
        generation: 1,
        maxValidityDays: ISSUING_MAX_VALIDITY_DAYS,
        extendedKeyUsages: ["1.3.6.1.5.5.7.3.1", "1.3.6.1.5.5.7.3.2"],
        closed: true,
      }}
      onValuesChange={(changed: Partial<CaValues>) => {
        if ("certificate" in changed) fill(changed.certificate);
      }}
      onFinish={submit}
    >
      <Row gutter={24}>
        <Col xs={24} xl={12}>
          <Form.Item
            name="certificate"
            label="Its certificate"
            extra="XCA: Certificates → the CA → Export, PEM. It fills in the rest."
            rules={[
              { required: true, message: "Drop, choose or paste it" },
              {
                validator: (_, value?: string) =>
                  !value || readCaCertificate(value)?.ca
                    ? Promise.resolve()
                    : Promise.reject(new Error("One CA certificate")),
              },
            ]}
          >
            <PemInput kind="certificate" rows={4} />
          </Form.Item>
          {read && !read.selfSigned && (
            <Form.Item
              name="parentId"
              label="Signed by"
              extra={`Its certificate names ${read.issuerName}: import that first if it is not here.`}
              rules={[
                { required: true, message: "Its parent, imported first" },
              ]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={`${read.issuerName}: not in Harpocrates`}
                options={issuers.map(caOption)}
              />
            </Form.Item>
          )}
        </Col>
        <Col xs={24} xl={12}>
          <Form.Item name="tier" label="Tier">
            <Radio.Group
              optionType="button"
              options={(["root", "intermediate", "issuing"] as const).map(
                (value) => ({ value, label: TIERS[value] }),
              )}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="id"
                label="ID"
                extra="A slug to know it by"
                rules={[
                  { required: true, message: "Required" },
                  {
                    pattern: /^[a-z][a-z0-9-]{0,62}$/,
                    message: "Lower case, digits and hyphens",
                  },
                ]}
              >
                <Input placeholder="xca-issuing-ca-1" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="number"
                label="Number"
                rules={[{ required: true, message: "Required" }]}
              >
                <InputNumber min={1} className={styles.fill} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="generation"
                label="Generation"
                rules={[{ required: true, message: "Required" }]}
              >
                <InputNumber min={1} className={styles.fill} />
              </Form.Item>
            </Col>
          </Row>
          {tier === "issuing" ? (
            <>
              <Form.Item
                name="privateKey"
                label="Its key"
                extra="XCA: Private keys → Export, PKCS#8 encrypted, with the key's password. It goes to the signer."
                rules={[
                  {
                    required: true,
                    message: "An issuing CA comes with its key",
                  },
                  {
                    pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
                    message: "An encrypted private key (PKCS#8)",
                  },
                ]}
              >
                <PemInput kind="key" rows={3} />
              </Form.Item>
              <Form.Item
                name="passphrase"
                label="The key's password"
                rules={[{ required: true, message: "Required" }]}
              >
                <Input.Password autoComplete="off" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="purpose" label="Purpose">
                    <Input placeholder="TLS, Service, Device" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="maxValidityDays"
                    label="Longest certificate, days"
                    rules={[{ required: true, message: "Required" }]}
                  >
                    <InputNumber min={1} className={styles.fill} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="extendedKeyUsages"
                label="Extended key usages it may sign"
              >
                <Select
                  mode="tags"
                  options={Object.entries(EKU_NAMES).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="closed"
                label="Closed"
                valuePropName="checked"
                extra="It signs its revocation lists and nothing new: XCA's CAs are imported closed (ADR 0037)."
              >
                <Switch />
              </Form.Item>
            </>
          ) : (
            <Typography.Paragraph type="secondary">
              {tier === "root" ? "A root" : "An intermediate"} is imported by
              its certificate alone: its key stays where XCA keeps it, and comes
              out only for a ceremony.
            </Typography.Paragraph>
          )}
        </Col>
      </Row>
      <ErrorAlert error={error} title="It could not be imported" />
      <Button type="primary" htmlType="submit" loading={busy}>
        Import the CA
      </Button>
    </Form>
  );
}

/**
 * A CA's newest list from XCA, before Harpocrates signs one: its number
 * continues from it, and its revocations carry into every list after.
 */
function ImportCrl({
  issuerId,
  onImported,
}: {
  issuerId?: string;
  onImported: (issuerId: string) => void;
}) {
  const [form] = Form.useForm<{ issuerId?: string; crl?: string }>();
  const { mutate } = useSWRConfig();
  const { data: all } = useIssuers();
  const { isAdmin } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [imported, setImported] = useState<{
    issuerId: string;
    crl: RevocationList;
  }>();
  const issuers = (all ?? []).filter((i) => !i.discardedAt && i.notAfter);

  const submit = async (values: { issuerId?: string; crl?: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      const { crl } = unwrap(
        await apiClient.POST("/v1/issuer/{issuerId}/crls", {
          params: { path: { issuerId: values.issuerId! } },
          body: { crl: values.crl! },
        }),
      );
      await mutate(REFRESHED);
      setImported({ issuerId: values.issuerId!, crl });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  if (imported) {
    return (
      <Result
        status="success"
        title={`Imported list #${imported.crl.number} for ${imported.issuerId}`}
        subTitle={`${imported.crl.entries} revoked. From now on Harpocrates publishes its lists: stop XCA publishing them.`}
        extra={[
          <Button
            key="next"
            type="primary"
            onClick={() => onImported(imported.issuerId)}
          >
            Import what it issued
          </Button>,
          <Button
            key="again"
            onClick={() => {
              form.resetFields();
              setImported(undefined);
            }}
          >
            Import another list
          </Button>,
        ]}
      />
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      className={`${styles.padded} ${styles.narrow}`}
      disabled={!isAdmin}
      initialValues={{ issuerId }}
      onValuesChange={(changed: { crl?: string }) => {
        if ("crl" in changed && !form.isFieldTouched("issuerId")) {
          const match = byName(
            issuers,
            changed.crl && readCrlIssuer(changed.crl),
          );
          if (match) form.setFieldsValue({ issuerId: match.id });
        }
      }}
      onFinish={submit}
    >
      <Form.Item
        name="crl"
        label="The list"
        extra="XCA: the CA → Generate CRL, then Revocation lists → Export. Generate it after the last revocation in XCA."
        rules={[{ required: true, message: "Drop, choose or paste it" }]}
      >
        <PemInput kind="crl" rows={4} />
      </Form.Item>
      <Form.Item
        name="issuerId"
        label="Its CA"
        rules={[{ required: true, message: "The CA that signed it" }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="The CA that signed it"
          options={issuers.map(caOption)}
        />
      </Form.Item>
      <ErrorAlert error={error} title="It could not be imported" />
      <Button type="primary" htmlType="submit" loading={busy}>
        Import the list
      </Button>
    </Form>
  );
}

type CertificatesValues = {
  mode: "record" | "key";
  certificates?: string;
  profileId?: string;
  importFormat: KeyImportFormat;
  keyData?: string;
  passphrase?: string;
  csr?: string;
};

/**
 * What a CA issued: many as a record, one export or several files, each
 * certificate under the profile it would renew by; or one with its key
 * (and the CSR it came from), the key escrowed (ADR 0039), which a
 * certificate already imported gains. Those that are not leaves, or whose
 * CA is not here, are skipped and said why.
 */
function ImportCertificates() {
  const [form] = Form.useForm<CertificatesValues>();
  const { mutate } = useSWRConfig();
  const { data: profiles } = useProfiles();
  const { isAdmin } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [answer, setAnswer] = useState<ImportCertificatesResponse>();
  const mode = Form.useWatch("mode", form) ?? "record";
  const importFormat = Form.useWatch("importFormat", form) ?? "pem";
  const withKey = mode === "key";

  const submit = async (values: CertificatesValues) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = unwrap(
        await apiClient.POST("/v1/certificates/import", {
          body: {
            profileId: values.profileId!,
            certificates: [values.certificates!],
            ...(withKey
              ? {
                  key: {
                    format: values.importFormat,
                    data: values.keyData!,
                    passphrase: values.passphrase!,
                  },
                  csr: values.csr || undefined,
                }
              : {}),
          },
        }),
      );
      await mutate(REFRESHED);
      setAnswer(result);
      form.setFieldsValue({
        certificates: undefined,
        keyData: undefined,
        passphrase: undefined,
        csr: undefined,
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const summary = !answer
    ? ""
    : answer.keyed.length
      ? "The certificate already here gained its key, escrowed"
      : withKey && answer.imported.length
        ? "Imported with its key, escrowed"
        : `Imported ${answer.imported.length}; skipped ${answer.skipped.length}`;

  return (
    <Flex vertical>
      <Form<CertificatesValues>
        form={form}
        layout="vertical"
        className={`${styles.padded} ${styles.narrow}`}
        disabled={!isAdmin}
        initialValues={{ mode: "record", importFormat: "pem" }}
        onValuesChange={() => setAnswer(undefined)}
        onFinish={submit}
      >
        <Form.Item name="mode">
          <Radio.Group
            optionType="button"
            options={[
              { value: "record", label: "Many, as a record" },
              { value: "key", label: "One, with its key" },
            ]}
          />
        </Form.Item>
        {withKey ? (
          <Form.Item
            name="certificates"
            label="The certificate"
            extra="XCA: Certificates → the certificate → Export, PEM. One already imported as a record gains its key."
            rules={[{ required: true, message: "Drop, choose or paste it" }]}
          >
            <PemInput kind="certificate" rows={4} />
          </Form.Item>
        ) : (
          <Form.Item
            name="certificates"
            label="The certificates"
            extra="XCA: select them all → Export → PEM, one file; or drop several. CAs among them are skipped: import those as CAs."
            rules={[{ required: true, message: "Drop, choose or paste them" }]}
          >
            <PemInput kind="certificates" rows={4} />
          </Form.Item>
        )}
        {withKey && (
          <>
            <Form.Item name="importFormat" label="Its key">
              <Radio.Group
                options={[
                  { value: "pem", label: "Encrypted PKCS#8 (PEM)" },
                  { value: "pkcs12", label: "PKCS#12 (.p12, .pfx)" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="keyData"
              extra={
                importFormat === "pkcs12"
                  ? "XCA: Certificates → the certificate → Export, PKCS#12. Only its key is used; it goes to the signer, escrowed."
                  : "XCA: Private keys → the key → Export, PKCS#8 encrypted. It goes to the signer, escrowed."
              }
              rules={[
                { required: true, message: "Bring the key" },
                ...(importFormat === "pem"
                  ? [
                      {
                        pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
                        message: "An encrypted PKCS#8 key",
                      },
                    ]
                  : []),
              ]}
            >
              <ImportKeyInput format={importFormat} />
            </Form.Item>
            <Form.Item
              name="passphrase"
              label="The key's password"
              extra="Used once to read it, never kept"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input.Password autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="csr"
              label="Its CSR"
              extra="Optional. XCA: Certificate signing requests → Export, PEM. It must be signed by the key."
            >
              <PemInput kind="csr" rows={3} />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="profileId"
          label="Taken as issued under"
          extra={
            withKey
              ? "Renewing it later follows this profile, from its CA in the new hierarchy. Its keys must be the signer's to hold: not a CSR-only profile."
              : "Renewing one later follows this profile, from its CA in the new hierarchy. Split an export whose certificates renew differently."
          }
          rules={[{ required: true, message: "A profile" }]}
        >
          <Select
            showSearch
            placeholder="A profile"
            options={(profiles ?? [])
              .filter((p) => !p.ssh && (!withKey || p.allowGenerated))
              .map((p) => ({ value: p.id, label: p.id }))}
          />
        </Form.Item>
        <ErrorAlert
          error={error}
          title={
            withKey ? "It could not be imported" : "They could not be imported"
          }
        />
        <Button type="primary" htmlType="submit" loading={busy}>
          {withKey ? "Import it with its key" : "Import the certificates"}
        </Button>
      </Form>
      {answer && (
        <>
          <Alert
            type={answer.skipped.length ? "warning" : "success"}
            showIcon
            banner
            title={summary}
          />
          {answer.skipped.length > 0 && (
            <Table<SkippedCertificate>
              size="small"
              rowKey={(row, i) => `${row.serial ?? ""}-${i}`}
              pagination={false}
              dataSource={answer.skipped}
              className={styles.flushTable}
              columns={[
                { title: "Subject", dataIndex: "subject" },
                { title: "Serial", dataIndex: "serial" },
                { title: "Why", dataIndex: "reason" },
              ]}
            />
          )}
        </>
      )}
    </Flex>
  );
}
