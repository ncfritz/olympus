import { Flex, Segmented, Table, Tag, Tooltip, Typography } from "antd";
import Link from "next/link";
import { type CSSProperties, useState } from "react";
import type {
  DashboardAuthority,
  DashboardCertificate,
  Issuer,
} from "@/lib/api/types";
import {
  HEALTH,
  LANE_ROWS,
  type LaneChip,
  placeChips,
  RENEWERS,
  shortName,
  timeUntil,
} from "@/lib/dashboard";
import { formatDate } from "@/lib/labels";
import { shortCaName } from "@/lib/tree";
import styles from "./Dashboard.module.css";

const DAY = 24 * 60 * 60 * 1000;
const ROW_HEIGHT = 26;
const LANE_CLASS = [styles.lane1, styles.lane2, styles.lane3];

const RANGES = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

/** A chip's place on its lane: the only values set from code. */
const chipPlace = (left: number, row: number) =>
  ({
    "--left": `${left}%`,
    "--top": `${4 + row * ROW_HEIGHT}px`,
  }) as CSSProperties;

/** The axis's labels: today, then three more across the range. */
const ticks = (days: number, now: number) =>
  [0, 1 / 3, 2 / 3, 1].map((f) =>
    f === 0
      ? "Today"
      : new Date(now + f * days * DAY).toLocaleDateString(undefined, {
          month: "short",
          day: days > 90 ? undefined : "numeric",
        }),
  );

type Chip = {
  id: string;
  /** When it falls: its expiry, or its list's next update. */
  at: string;
  label: string;
  title: string;
  color: string;
  href: string;
};

type Lane = {
  key: string;
  name: string;
  href?: string;
  sub: string;
  chips: LaneChip<Chip>[];
};

/**
 * What expires, and when: one lane per CA (or profile) across the next 30
 * days, 90 days or year, each certificate a chip coloured by its health,
 * the revocation lists' next updates in a lane of their own; then the
 * next to expire as a table.
 */
export function TimelineView({
  certificates,
  authorities,
  issuers,
  now,
}: {
  certificates: DashboardCertificate[];
  authorities: DashboardAuthority[];
  issuers: Issuer[];
  now: number;
}) {
  const [days, setDays] = useState(90);
  const [group, setGroup] = useState<"ca" | "profile">("ca");
  const names = new Map(issuers.map((i) => [i.id, shortCaName(i)]));
  const ahead = now + days * DAY;
  const upcoming = certificates.filter(
    (c) => c.health !== "expired" && Date.parse(c.notAfter) <= ahead,
  );

  const chip = (c: DashboardCertificate): Chip => ({
    id: c.certificateId,
    at: c.notAfter,
    label: shortName(c.name),
    title: `${c.name}: expires ${formatDate(c.notAfter)} (in ${timeUntil(c.notAfter, now)}). ${HEALTH[c.health].label}; ${RENEWERS[c.renewer]}.`,
    color: HEALTH[c.health].color,
    href: `/certificate?id=${c.certificateId}`,
  });
  const keys = [
    ...new Set(
      upcoming.map((c) =>
        group === "ca" ? c.issuerId : (c.profileId ?? "No profile"),
      ),
    ),
  ];
  const lanes: Lane[] = keys.map((key) => {
    const mine = upcoming.filter((c) =>
      group === "ca"
        ? c.issuerId === key
        : (c.profileId ?? "No profile") === key,
    );
    return {
      key,
      name: group === "ca" ? (names.get(key) ?? key) : key,
      href: group === "ca" ? `/ca?id=${key}` : undefined,
      sub: `${mine.length} expiring`,
      chips: placeChips(mine.map(chip), (c) => c.at, days, now),
    };
  });
  // The online CAs' lists are re-signed daily: one chip for them all.
  const lists = authorities.filter(
    (a) => a.nextUpdate && Date.parse(a.nextUpdate) <= ahead,
  );
  const online = lists.filter((a) => !a.offline);
  const listChips: Chip[] = [
    ...(online.length
      ? [
          {
            id: "online",
            at: online.map((a) => a.nextUpdate!).sort()[0],
            label: `${online.length} online CA${online.length === 1 ? "" : "s"}`,
            title: `The online CAs' lists lapse from ${formatDate(online.map((a) => a.nextUpdate!).sort()[0])}, and are re-signed daily.`,
            color: "blue",
            href: "/roots",
          },
        ]
      : []),
    ...lists
      .filter((a) => a.offline)
      .map((a) => ({
        id: a.issuerId,
        at: a.nextUpdate!,
        label: names.get(a.issuerId) ?? a.issuerId,
        title: `${names.get(a.issuerId)}'s list lapses ${formatDate(a.nextUpdate)}: a ceremony signs the next.`,
        color: "orange",
        href: `/ca?id=${a.issuerId}`,
      })),
  ];
  if (listChips.length) {
    lanes.push({
      key: "lists",
      name: "Revocation lists",
      sub: "next update",
      chips: placeChips(listChips, (c) => c.at, days, now),
    });
  }
  const next = certificates.filter((c) => c.health !== "expired").slice(0, 8);

  return (
    <Flex vertical>
      <Flex
        justify="space-between"
        align="center"
        gap="small"
        wrap
        className={styles.filters}
      >
        <Flex gap={4} wrap>
          {(["failing", "needs-person", "renewing", "healthy"] as const).map(
            (h) => (
              <Tag key={h} color={HEALTH[h].color}>
                {HEALTH[h].label}
              </Tag>
            ),
          )}
        </Flex>
        <Flex gap="small" wrap>
          <Segmented
            value={days}
            onChange={(v) => setDays(v as number)}
            options={RANGES}
          />
          <Segmented
            value={group}
            onChange={(v) => setGroup(v as "ca" | "profile")}
            options={[
              { value: "ca", label: "By CA" },
              { value: "profile", label: "By profile" },
            ]}
          />
        </Flex>
      </Flex>
      <Flex vertical gap="small" className={styles.padded}>
        <div className={styles.laneRow}>
          <span />
          <Flex justify="space-between">
            {ticks(days, now).map((label, i) => (
              <Typography.Text
                key={i}
                type="secondary"
                className={styles.small}
              >
                {label}
              </Typography.Text>
            ))}
          </Flex>
        </div>
        {lanes.length === 0 && (
          <Typography.Text type="secondary">
            Nothing expires in this range.
          </Typography.Text>
        )}
        {lanes.map((lane) => {
          const rows = Math.min(
            Math.max(...lane.chips.map((c) => c.row)) + 1,
            LANE_ROWS,
          );
          return (
            <div key={lane.key} className={styles.laneRow}>
              <Flex vertical className={styles.shrink}>
                {lane.href ? (
                  <Link href={lane.href}>
                    <Typography.Text ellipsis className={styles.laneName}>
                      {lane.name}
                    </Typography.Text>
                  </Link>
                ) : (
                  <Typography.Text ellipsis className={styles.laneName}>
                    {lane.name}
                  </Typography.Text>
                )}
                <Typography.Text type="secondary" className={styles.small}>
                  {lane.sub}
                </Typography.Text>
              </Flex>
              <div className={`${styles.lane} ${LANE_CLASS[rows - 1]}`}>
                {lane.chips.map(({ item, left, row }) => (
                  <Tooltip key={item.id} title={item.title}>
                    <Link
                      href={item.href}
                      aria-label={item.title}
                      className={styles.chip}
                      style={chipPlace(left, row)}
                    >
                      <Tag color={item.color} className={styles.chipTag}>
                        {item.label}
                      </Tag>
                    </Link>
                  </Tooltip>
                ))}
              </div>
            </div>
          );
        })}
      </Flex>
      <Typography.Text strong className={`${styles.boxTitle} ${styles.padded}`}>
        Next up
      </Typography.Text>
      <Table<DashboardCertificate>
        rowKey="certificateId"
        size="middle"
        pagination={false}
        dataSource={next}
        scroll={{ x: "max-content" }}
        className={styles.flushTable}
        locale={{ emptyText: "Nothing to renew" }}
        columns={[
          {
            title: "When",
            key: "when",
            render: (_, c) => (
              <Tag color={HEALTH[c.health].color}>
                in {timeUntil(c.notAfter, now)}
              </Tag>
            ),
          },
          {
            title: "Certificate",
            key: "certificate",
            render: (_, c) => (
              <Link href={`/certificate?id=${c.certificateId}`}>{c.name}</Link>
            ),
          },
          {
            title: "CA",
            key: "ca",
            render: (_, c) => (
              <Typography.Text type="secondary">
                {names.get(c.issuerId) ?? c.issuerId}
              </Typography.Text>
            ),
          },
          {
            title: "How it renews",
            key: "how",
            render: (_, c) => (
              <span>
                {RENEWERS[c.renewer]}
                {c.health === "failing" || c.health === "needs-person"
                  ? ` · ${HEALTH[c.health].label.toLowerCase()}`
                  : ""}
              </span>
            ),
          },
          {
            title: "",
            key: "open",
            align: "right",
            render: (_, c) => (
              <Link href={`/certificate?id=${c.certificateId}`}>Open</Link>
            ),
          },
        ]}
      />
    </Flex>
  );
}
