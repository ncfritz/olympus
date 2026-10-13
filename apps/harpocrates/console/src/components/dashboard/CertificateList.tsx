import {
  Flex,
  Input,
  Progress,
  Segmented,
  Select,
  Table,
  Tag,
  theme,
  Typography,
} from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CertificateHealth,
  DashboardCertificate,
  Issuer,
  Renewer,
} from "@/lib/api/types";
import { HEALTH, RENEWERS, timeSince, timeUntil } from "@/lib/dashboard";
import { formatDate } from "@/lib/labels";
import { shortCaName } from "@/lib/tree";
import styles from "./Dashboard.module.css";

/** How the expirations' list treats expired certificates. */
type ExpiredFilter = "hide" | "show" | "only";

const shortSerial = (serial: string) =>
  serial.length > 12 ? `${serial.slice(0, 4)}…${serial.slice(-4)}` : serial;

/**
 * The certificates nothing has replaced, as a table to the page's edges:
 * their names, profile, CA, expiry (with how much of their life is left),
 * who renews them and their health. By health (the Certificates tab: the
 * worst first, a filter per health), or by expiry (the Expirations tab:
 * soonest first, expired hidden, shown or alone).
 */
export function CertificateList({
  certificates,
  issuers,
  now,
  order,
}: {
  certificates: DashboardCertificate[];
  issuers: Issuer[];
  now: number;
  order: "health" | "expiry";
}) {
  const { token } = theme.useToken();
  const [search, setSearch] = useState("");
  const [ca, setCa] = useState<string>();
  const [profile, setProfile] = useState<string>();
  const [renewer, setRenewer] = useState<Renewer>();
  const [health, setHealth] = useState<CertificateHealth | "all">("all");
  const [expired, setExpired] = useState<ExpiredFilter>("hide");
  const names = new Map(issuers.map((i) => [i.id, shortCaName(i)]));

  // In health order, expired certificates are the Expirations tab's.
  const pool = useMemo(
    () =>
      order === "health"
        ? certificates.filter((c) => c.health !== "expired")
        : certificates,
    [certificates, order],
  );
  const matching = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return pool.filter(
      (c) =>
        (!ca || c.issuerId === ca) &&
        (!profile || c.profileId === profile) &&
        (!renewer || c.renewer === renewer) &&
        (!needle ||
          [c.name, c.serial, ...c.names].some((v) =>
            v.toLowerCase().includes(needle),
          )),
    );
  }, [pool, search, ca, profile, renewer]);
  const shown = useMemo(() => {
    const rows =
      order === "health"
        ? matching.filter((c) => health === "all" || c.health === health)
        : matching.filter((c) =>
            expired === "only"
              ? c.health === "expired"
              : expired === "hide"
                ? c.health !== "expired"
                : true,
          );
    return [...rows].sort((a, b) =>
      order === "health"
        ? HEALTH[a.health].order - HEALTH[b.health].order ||
          Date.parse(a.notAfter) - Date.parse(b.notAfter)
        : Date.parse(a.notAfter) - Date.parse(b.notAfter),
    );
  }, [matching, order, health, expired]);

  const count = (h: CertificateHealth) =>
    matching.filter((c) => c.health === h).length;
  const profiles = [
    ...new Set(certificates.flatMap((c) => (c.profileId ? [c.profileId] : []))),
  ].sort();
  const usedCas = [...new Set(certificates.map((c) => c.issuerId))];

  return (
    <Flex vertical>
      <Flex gap="small" wrap align="center" className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Subject, name or serial"
          className={styles.search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search the certificates"
        />
        <Select
          allowClear
          placeholder="All CAs"
          className={styles.filter}
          value={ca}
          onChange={setCa}
          options={usedCas.map((id) => ({
            value: id,
            label: names.get(id) ?? id,
          }))}
          aria-label="CA"
        />
        <Select
          allowClear
          placeholder="All profiles"
          className={styles.filter}
          value={profile}
          onChange={setProfile}
          options={profiles.map((id) => ({ value: id, label: id }))}
          aria-label="Profile"
        />
        <Select
          allowClear
          placeholder="Renewed by anything"
          className={styles.filter}
          value={renewer}
          onChange={setRenewer}
          options={(Object.keys(RENEWERS) as Renewer[]).map((r) => ({
            value: r,
            label: RENEWERS[r],
          }))}
          aria-label="Who renews them"
        />
        <span className={styles.spacer} />
        {order === "health" ? (
          <Segmented
            value={health}
            onChange={(v) => setHealth(v as CertificateHealth | "all")}
            options={[
              { value: "all", label: `All ${matching.length}` },
              ...(
                ["failing", "needs-person", "renewing", "healthy"] as const
              ).map((h) => ({
                value: h,
                label: `${HEALTH[h].label} ${count(h)}`,
              })),
            ]}
          />
        ) : (
          <Segmented
            value={expired}
            onChange={(v) => setExpired(v as ExpiredFilter)}
            options={[
              { value: "hide", label: "Hide expired" },
              { value: "show", label: "Show expired" },
              { value: "only", label: `Only expired ${count("expired")}` },
            ]}
          />
        )}
      </Flex>
      <Table<DashboardCertificate>
        rowKey="certificateId"
        size="middle"
        dataSource={shown}
        scroll={{ x: "max-content" }}
        pagination={{
          pageSize: 10,
          hideOnSinglePage: true,
          showTotal: (total, [from, to]) => `${from}–${to} of ${total}`,
        }}
        locale={{ emptyText: "No certificates match" }}
        className={styles.flushTable}
        columns={[
          {
            title: "Subject",
            key: "subject",
            render: (_, c) => (
              <Flex vertical className={styles.subject}>
                <Link href={`/certificate?id=${c.certificateId}`}>
                  {c.name}
                </Link>
                {c.names.length > 0 && (
                  <Typography.Text
                    type="secondary"
                    className={styles.small}
                    ellipsis={{ tooltip: c.names.join(", ") }}
                  >
                    {c.names.join(", ")}
                  </Typography.Text>
                )}
              </Flex>
            ),
          },
          {
            title: "Profile",
            key: "profile",
            render: (_, c) =>
              c.profileId ? (
                <Tag>
                  {c.profileId}
                  {c.profileVersion ? ` v${c.profileVersion}` : ""}
                </Tag>
              ) : (
                "—"
              ),
          },
          {
            title: "CA",
            key: "ca",
            render: (_, c) => (
              <Typography.Text type="secondary" className={styles.nowrap}>
                {names.get(c.issuerId) ?? c.issuerId}
              </Typography.Text>
            ),
          },
          {
            title: "Expires",
            key: "expires",
            render: (_, c) => {
              const life = Date.parse(c.notAfter) - Date.parse(c.notBefore);
              const left = Math.max(0, Date.parse(c.notAfter) - now);
              return (
                <Flex vertical className={styles.expires}>
                  <Tag color={HEALTH[c.health].color} className={styles.fitTag}>
                    {c.health === "expired"
                      ? timeSince(c.notAfter, now)
                      : `in ${timeUntil(c.notAfter, now)}`}
                  </Tag>
                  <Typography.Text
                    type="secondary"
                    className={`${styles.small} ${styles.nowrap}`}
                  >
                    {formatDate(c.notAfter)}
                  </Typography.Text>
                  <Progress
                    percent={life > 0 ? Math.round((left / life) * 100) : 0}
                    showInfo={false}
                    size={[120, 4]}
                    strokeColor={
                      c.health === "healthy"
                        ? token.colorSuccess
                        : c.health === "renewing"
                          ? token.colorPrimary
                          : c.health === "expired"
                            ? token.colorTextQuaternary
                            : c.health === "failing"
                              ? token.colorError
                              : token.colorWarning
                    }
                    aria-label={`${Math.round((left / Math.max(life, 1)) * 100)}% of its life left`}
                    className={styles.bar}
                  />
                </Flex>
              );
            },
          },
          {
            title: "Renews by",
            key: "renewer",
            render: (_, c) => (
              <Flex vertical>
                <Typography.Text className={styles.nowrap}>
                  {RENEWERS[c.renewer]}
                </Typography.Text>
                <Typography.Text
                  type="secondary"
                  className={`${styles.small} ${styles.nowrap}`}
                >
                  {c.renewed ? "Renewed" : "Issued"} {formatDate(c.issuedAt)}
                </Typography.Text>
              </Flex>
            ),
          },
          {
            title: "Health",
            key: "health",
            render: (_, c) => (
              <Tag color={HEALTH[c.health].color}>{HEALTH[c.health].label}</Tag>
            ),
          },
          {
            title: "Serial",
            dataIndex: "serial",
            render: (serial: string) => (
              <Typography.Text code title={serial}>
                {shortSerial(serial)}
              </Typography.Text>
            ),
          },
        ]}
      />
    </Flex>
  );
}
