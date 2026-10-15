import {
  Button,
  Flex,
  Input,
  Select,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import type { CertificateLineage, Issuer, Renewer } from "@/lib/api/types";
import { HEALTH, RENEWERS, timeSince, timeUntil } from "@/lib/dashboard";
import { formatDate, REVOCATION_REASONS } from "@/lib/labels";
import {
  BUCKETS,
  type Bucket,
  daysLeft,
  EXPIRY_BUCKETS,
  isHeld,
  newestOf,
  RENEWAL_BUCKETS,
} from "@/lib/lineages";
import { shortCaName } from "@/lib/tree";
import styles from "./Certificates.module.css";
import {
  kindOf,
  Lifeline,
  place,
  useVersionColors,
  VERSION_LABELS,
  VERSION_TAGS,
} from "./Lifeline";

const DAY = 24 * 60 * 60 * 1000;

/** The strips' axis: the last year, and four months ahead. */
const BEFORE = 365 * DAY;
const AFTER = 120 * DAY;

type Shown = "all" | "held" | "ended";

/** A lineage's expiry, as a tag: red within a week, amber within 30 days. */
export function ExpiryTag({
  lineage,
  now,
}: {
  lineage: CertificateLineage;
  now: number;
}) {
  if (lineage.state === "revoked") return <Tag color="red">Revoked</Tag>;
  const left = daysLeft(lineage, now);
  const notAfter = newestOf(lineage).notAfter;
  if (left <= 0) {
    return <Tag>Expired {timeSince(notAfter, now)}</Tag>;
  }
  return (
    <Tag color={left <= 7 ? "red" : left <= 30 ? "orange" : "green"}>
      in {timeUntil(notAfter, now)}
    </Tag>
  );
}

/** A lineage's health, as a tag; a revoked one has none. */
export function HealthTag({ lineage }: { lineage: CertificateLineage }) {
  if (!lineage.health) return <Tag color="red">Revoked</Tag>;
  const { label, color } = HEALTH[lineage.health];
  return <Tag color={color}>{label}</Tag>;
}

/**
 * The Certificates tab's list: the expiry and renewal alerts, each a
 * filter; the filters; then each certificate's lineage, its versions
 * over the last year as a strip, its newest version's expiry, health and
 * renewer, and its versions one to a line beneath when expanded.
 */
export function LineageList({
  lineages,
  issuers,
  now,
  issuerId: initialIssuerId,
  onOpen,
}: {
  lineages: CertificateLineage[];
  issuers: Issuer[];
  now: number;
  /** The CA to filter by at first: a link from a CA's page. */
  issuerId?: string;
  onOpen: (certificateId: string) => void;
}) {
  const colors = useVersionColors();
  const [bucket, setBucket] = useState<Bucket>();
  const [issuerId, setIssuerId] = useState(initialIssuerId);
  const [profileId, setProfileId] = useState<string>();
  const [renewer, setRenewer] = useState<Renewer>();
  const [shown, setShown] = useState<Shown>("all");
  const [search, setSearch] = useState("");
  const names = useMemo(
    () => new Map(issuers.map((i) => [i.id, shortCaName(i)])),
    [issuers],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(BUCKETS) as Bucket[]).map((key) => [
          key,
          lineages.filter((l) => BUCKETS[key].test(l, now)).length,
        ]),
      ) as Record<Bucket, number>,
    [lineages, now],
  );
  const start = now - BEFORE;
  const end = now + AFTER;

  const text = search.trim().toLowerCase();
  const rows = lineages.filter(
    (l) =>
      (!bucket || BUCKETS[bucket].test(l, now)) &&
      (!issuerId || l.issuerId === issuerId) &&
      (!profileId || l.profileId === profileId) &&
      (!renewer || l.renewer === renewer) &&
      (shown === "all" || (shown === "held") === isHeld(l)) &&
      (!text ||
        l.name.toLowerCase().includes(text) ||
        l.names.some((n) => n.toLowerCase().includes(text)) ||
        l.versions.some((v) => v.serial.toLowerCase().includes(text))),
  );
  const profiles = [
    ...new Set(lineages.flatMap((l) => (l.profileId ? [l.profileId] : []))),
  ].sort();
  const cas = [...new Set(lineages.map((l) => l.issuerId))];

  const panel = (title: string, keys: Bucket[]) => (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.section}>{title}</div>
      <div className={styles.buckets}>
        {keys.map((key) => {
          const severe = key === "d7" || key === "failing";
          const warn = key === "d30" || key === "needsPerson" || key === "gaps";
          return (
            <button
              key={key}
              type="button"
              aria-pressed={bucket === key}
              className={`${styles.bucket} ${bucket === key ? styles.bucketOn : ""}`}
              onClick={() => setBucket(bucket === key ? undefined : key)}
            >
              <Typography.Text type="secondary" className={styles.small}>
                {BUCKETS[key].label}
              </Typography.Text>
              <Typography.Text type="secondary" className={styles.small}>
                {BUCKETS[key].sub}
              </Typography.Text>
              <span className={styles.bucketCount}>
                {counts[key] > 0 && (severe || warn) && (
                  <span
                    className={`${styles.mark} ${severe ? styles.markError : styles.markWarning}`}
                  />
                )}
                <Typography.Text className={styles.count}>
                  {counts[key]}
                </Typography.Text>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const ticks = [-365, -270, -180, -90, 0, 90].map((days) => now + days * DAY);
  const columns: TableColumnsType<CertificateLineage> = [
    {
      title: "Certificate",
      key: "name",
      render: (_, l) => (
        <Flex vertical className={styles.shrink}>
          <Typography.Link
            strong
            ellipsis
            onClick={(e) => {
              e.stopPropagation();
              onOpen(newestOf(l).certificateId);
            }}
          >
            {l.name}
          </Typography.Link>
          <Typography.Text type="secondary" className={styles.small} ellipsis>
            {names.get(l.issuerId) ?? l.issuerId}
            {l.profileId ? ` · ${l.profileId}` : ""} · {l.versions.length}{" "}
            version{l.versions.length === 1 ? "" : "s"}
            {l.deployTargets.length
              ? ` · deployed to ${l.deployTargets.join(", ")}`
              : ""}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: (
        <div
          className={styles.axis}
          aria-label="The last year, and four months ahead"
        >
          {ticks.map((t) => (
            <span
              key={t}
              className={`${styles.tick} ${t === now ? styles.tickToday : ""}`}
              style={place(t, t, start, end)}
            >
              {t === now
                ? "Today"
                : new Date(t).toLocaleDateString(undefined, {
                    month: "short",
                    year: "2-digit",
                  })}
            </span>
          ))}
        </div>
      ),
      key: "versions",
      width: "34%",
      render: (_, l) => (
        <Lifeline lineage={l} start={start} end={end} now={now} />
      ),
    },
    {
      title: "Expires",
      key: "expires",
      width: 170,
      render: (_, l) => (
        <Flex vertical align="flex-start" gap={2}>
          <span className={styles.nowrap}>
            {formatDate(newestOf(l).notAfter)}
          </span>
          <ExpiryTag lineage={l} now={now} />
        </Flex>
      ),
    },
    {
      title: "Health",
      key: "health",
      width: 140,
      render: (_, l) => <HealthTag lineage={l} />,
    },
    {
      title: "Renewed by",
      key: "renewer",
      width: 150,
      render: (_, l) => (
        <Typography.Text className={styles.nowrap}>
          {RENEWERS[l.renewer]}
        </Typography.Text>
      ),
    },
  ];

  return (
    <Flex vertical className={styles.fill}>
      <div className={styles.alerts}>
        {panel("Expiry", EXPIRY_BUCKETS)}
        {panel("Renewal", RENEWAL_BUCKETS)}
      </div>
      <Flex gap="small" align="center" wrap className={styles.filters}>
        <Input.Search
          allowClear
          placeholder="Name, alternative name or serial"
          aria-label="Search the certificates"
          className={styles.search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select<string>
          allowClear
          placeholder="All CAs"
          aria-label="CA"
          className={styles.filter}
          value={issuerId}
          onChange={setIssuerId}
          options={cas.map((id) => ({
            value: id,
            label: names.get(id) ?? id,
          }))}
        />
        <Select<string>
          allowClear
          placeholder="All profiles"
          aria-label="Profile"
          className={styles.filter}
          value={profileId}
          onChange={setProfileId}
          options={profiles.map((id) => ({ value: id, label: id }))}
        />
        <Select<Renewer>
          allowClear
          placeholder="Anyone renews"
          aria-label="Renewed by"
          className={styles.filter}
          value={renewer}
          onChange={setRenewer}
          options={(Object.keys(RENEWERS) as Renewer[]).map((value) => ({
            value,
            label: RENEWERS[value],
          }))}
        />
        <Select<Shown>
          aria-label="Shown"
          className={styles.filter}
          value={shown}
          onChange={setShown}
          options={[
            { value: "all", label: "Held and ended" },
            { value: "held", label: "Held now" },
            { value: "ended", label: "Expired or revoked" },
          ]}
        />
        {bucket && (
          <Tag closable onClose={() => setBucket(undefined)}>
            {BUCKETS[bucket].label} {BUCKETS[bucket].sub}
          </Tag>
        )}
        <span className={styles.spacer} />
        <Flex gap="middle" wrap className={styles.legend}>
          {(["current", "replaced", "revoked", "expired"] as const).map(
            (kind) => (
              <span key={kind} className={styles.legendItem}>
                <svg width={10} height={10} aria-hidden>
                  <rect width={10} height={10} rx={2} fill={colors[kind]} />
                </svg>
                {VERSION_LABELS[kind]}
              </span>
            ),
          )}
          <span className={styles.legendItem}>
            <span className={styles.gapSwatch} />
            Gap: nothing valid
          </span>
        </Flex>
      </Flex>
      <Table<CertificateLineage>
        rowKey="lineageId"
        size="middle"
        dataSource={rows}
        columns={columns}
        className={styles.flushTable}
        tableLayout="fixed"
        scroll={rows.length ? { x: 1000 } : undefined}
        pagination={{
          pageSize: 50,
          size: "small",
          showSizeChanger: false,
          showTotal: (total) => `${total} certificate${total === 1 ? "" : "s"}`,
        }}
        locale={{ emptyText: "No certificate matches" }}
        expandable={{
          expandRowByClick: true,
          expandedRowRender: (l) => (
            <Versions
              lineage={l}
              start={start}
              end={end}
              now={now}
              names={names}
              onOpen={onOpen}
            />
          ),
        }}
      />
    </Flex>
  );
}

/** A lineage's versions, one to a line, each on the list's axis. */
function Versions({
  lineage,
  start,
  end,
  now,
  names,
  onOpen,
}: {
  lineage: CertificateLineage;
  start: number;
  end: number;
  now: number;
  names: Map<string, string>;
  onOpen: (certificateId: string) => void;
}) {
  const count = lineage.versions.length;
  return (
    <div className={styles.versions}>
      {lineage.versions.map((version, i) => {
        const kind = kindOf(version, i === 0);
        return (
          <div key={version.certificateId} className={styles.versionRow}>
            <Typography.Text strong>v{count - i}</Typography.Text>
            <Typography.Text code className={styles.nowrap}>
              {version.serial}
            </Typography.Text>
            <Lifeline
              lineage={lineage}
              versions={[version]}
              start={start}
              end={end}
              now={now}
            />
            <Typography.Text className={styles.nowrap}>
              {formatDate(version.notBefore)} → {formatDate(version.notAfter)}
            </Typography.Text>
            <Flex gap={4} align="center" wrap>
              <Tag color={VERSION_TAGS[kind]}>{VERSION_LABELS[kind]}</Tag>
              {version.revocationReason && (
                <Typography.Text type="secondary" className={styles.small}>
                  {REVOCATION_REASONS[version.revocationReason]}
                </Typography.Text>
              )}
              {version.issuerId !== lineage.issuerId && (
                <Typography.Text type="secondary" className={styles.small}>
                  {names.get(version.issuerId) ?? version.issuerId}
                </Typography.Text>
              )}
            </Flex>
            <Button
              size="small"
              type="link"
              onClick={() => onOpen(version.certificateId)}
            >
              Open
            </Button>
          </div>
        );
      })}
    </div>
  );
}
