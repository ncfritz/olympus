import { Alert, Flex, Tooltip, Typography } from "antd";
import type { CSSProperties } from "react";
import type { SshCertificate } from "@/lib/api/types";
import { formatDateTime } from "@/lib/labels";
import {
  DAY,
  holderOf,
  hostsNotRenewing,
  laneOf,
  shortFingerprint,
} from "@/lib/sshCertificates";
import { useTypeColors } from "../cas/SshGraphs";
import styles from "./SshCertificates.module.css";

const HOUR = DAY / 24;

/** A span's place on the axis, cut to it: the only values set from code. */
const at = (
  from: number,
  to: number,
  start: number,
  end: number,
  color?: string,
) => {
  const a = Math.min(Math.max(from, start), end);
  const b = Math.min(Math.max(to, start), end);
  return {
    "--from": `${((a - start) / (end - start)) * 100}%`,
    "--width": `${(Math.max(b - a, 0) / (end - start)) * 100}%`,
    ...(color ? { "--color": color } : {}),
  } as CSSProperties;
};

const paint = (color: string) => ({ "--color": color }) as CSSProperties;

type Lane = {
  key: string;
  label: string;
  sub?: string;
  bars: SshCertificate[];
};

/** The certificates touching a window, a lane each: newest activity first. */
const lanesOf = (
  certificates: SshCertificate[],
  start: number,
  end: number,
): Lane[] => {
  const lanes = new Map<string, Lane>();
  for (const c of certificates) {
    if (Date.parse(c.validBefore) < start || Date.parse(c.validAfter) > end) {
      continue;
    }
    const key = laneOf(c);
    const lane = lanes.get(key) ?? {
      key,
      label: holderOf(c),
      sub:
        c.type === "user"
          ? `key ${shortFingerprint(c.fingerprint)}`
          : c.principals.slice(1).join(", ") || undefined,
      bars: [],
    };
    lane.bars.push(c);
    lanes.set(key, lane);
  }
  const latest = (lane: Lane) =>
    Math.max(...lane.bars.map((c) => Date.parse(c.validBefore)));
  return [...lanes.values()].sort((a, b) => latest(a) - latest(b));
};

/** One axis: its lanes of certificates, today across them. */
function Lanes({
  title,
  head,
  lanes,
  start,
  end,
  now,
  ticks,
  tickLabel,
  color,
  onOpen,
}: {
  title: string;
  head: string;
  lanes: Lane[];
  start: number;
  end: number;
  now: number;
  ticks: number[];
  tickLabel: (offset: number) => string;
  color: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section aria-label={title}>
      <div className={styles.section}>{title}</div>
      <div className={`${styles.lane} ${styles.laneHead}`} aria-hidden>
        <span>{head}</span>
        <div className={styles.axis}>
          {ticks.map((t) => (
            <span
              key={t}
              className={`${styles.tick} ${t === 0 ? styles.tickToday : ""}`}
              style={at(now + t, now + t, start, end)}
            >
              {t === 0 ? "Now" : tickLabel(t)}
            </span>
          ))}
        </div>
      </div>
      {lanes.length === 0 ? (
        <div className={styles.padded}>
          <Typography.Text type="secondary">
            None in this window.
          </Typography.Text>
        </div>
      ) : (
        lanes.map((lane) => (
          <div key={lane.key} className={styles.lane}>
            <Flex vertical className={styles.shrink}>
              <Typography.Text strong ellipsis={{ tooltip: lane.label }}>
                {lane.label}
              </Typography.Text>
              {lane.sub && (
                <Typography.Text
                  type="secondary"
                  className={`${styles.small} ${styles.mono}`}
                  ellipsis
                >
                  {lane.sub}
                </Typography.Text>
              )}
            </Flex>
            <div className={styles.laneTrack}>
              {lane.bars.map((c) => {
                const from = Date.parse(c.validAfter);
                // Its successor takes over from when it starts.
                const next = lane.bars
                  .map((other) => Date.parse(other.validAfter))
                  .filter((start) => start > from)
                  .sort((a, b) => a - b)[0];
                const until = Math.min(
                  c.revokedAt
                    ? Math.max(from, Date.parse(c.revokedAt))
                    : Date.parse(c.validBefore),
                  next ?? Infinity,
                );
                const expired = Date.parse(c.validBefore) <= now;
                return (
                  <Tooltip
                    key={c.id}
                    title={`${c.principals.join(", ")}: ${formatDateTime(c.validAfter)} to ${formatDateTime(c.validBefore)}${c.revokedAt ? `, revoked ${formatDateTime(c.revokedAt)}` : ""}`}
                  >
                    <button
                      type="button"
                      className={`${styles.bar} ${c.revokedAt ? styles.revokedBar : ""} ${expired && !c.revokedAt ? styles.expired : ""}`}
                      style={at(from, until, start, end, color)}
                      onClick={() => onOpen(c.id)}
                      aria-label={`${lane.label}: ${c.principals.join(", ")}`}
                    >
                      {c.revokedAt
                        ? "revoked"
                        : expired
                          ? ""
                          : c.principals.join(", ")}
                    </button>
                  </Tooltip>
                );
              })}
              <span className={styles.now} style={at(now, now, start, end)} />
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/**
 * The Timeline tab: people's certificates over the last two days and the
 * next 16 hours, a lane for each person's key; hosts' over a month either
 * side, a lane for each host. Revoked ones red, expired ones faded. A
 * certificate chosen opens in the list.
 */
export function CertificateTimeline({
  certificates,
  now,
  onOpen,
}: {
  certificates: SshCertificate[];
  now: number;
  onOpen: (id: string) => void;
}) {
  const colors = useTypeColors();
  const users = certificates.filter((c) => c.type === "user");
  const hosts = certificates.filter((c) => c.type === "host");
  const userStart = now - 48 * HOUR;
  const userEnd = now + 16 * HOUR;
  const hostStart = now - 30 * DAY;
  const hostEnd = now + 30 * DAY;
  const stuck = hostsNotRenewing(certificates, now);
  return (
    <Flex vertical>
      <Flex gap="middle" wrap className={`${styles.filters} ${styles.legend}`}>
        <span className={styles.legendItem}>
          <span className={styles.swatch} style={paint(colors.user)} />
          User certificate
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} style={paint(colors.host)} />
          Host certificate
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.revokedBar}`} />
          Revoked
        </span>
        <span className={styles.legendItem}>
          <span className={styles.nowSwatch} />
          Now
        </span>
        <span className={styles.legendItem}>Faded: expired</span>
      </Flex>
      {stuck.map((c) => (
        <Alert
          key={c.id}
          type="warning"
          showIcon
          className={styles.alert}
          title={`${holderOf(c)} is due to renew, and has never renewed itself`}
          description={`Its certificate was issued by hand and expires ${formatDateTime(c.validBefore)}. Install the harpocrates-ssh-host timer on it, or issue the next by hand before then.`}
        />
      ))}
      <Lanes
        title="People: the last two days and the next 16 hours"
        head="Person · key"
        lanes={lanesOf(users, userStart, userEnd)}
        start={userStart}
        end={userEnd}
        now={now}
        ticks={[-36, -24, -12, 0, 12].map((h) => h * HOUR)}
        tickLabel={(t) => `${t > 0 ? "+" : ""}${Math.round(t / HOUR)} h`}
        color={colors.user}
        onOpen={onOpen}
      />
      <Lanes
        title="Hosts: a month either side"
        head="Host"
        lanes={lanesOf(hosts, hostStart, hostEnd)}
        start={hostStart}
        end={hostEnd}
        now={now}
        ticks={[-20, -10, 0, 10, 20].map((d) => d * DAY)}
        tickLabel={(t) => `${t > 0 ? "+" : ""}${Math.round(t / DAY)} d`}
        color={colors.host}
        onOpen={onOpen}
      />
    </Flex>
  );
}
