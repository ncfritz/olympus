import { Flex, Segmented, Tooltip, Typography } from "antd";
import { type CSSProperties, useState } from "react";
import { DAY, stateOf, type WindowState, windowStateOf } from "@/lib/acme";
import type { AcmeClient } from "@/lib/api/types";
import { formatDate } from "@/lib/labels";
import styles from "./Acme.module.css";

/** The ranges the timeline shows: days before today, and after. */
const RANGES = {
  "120 days": [30, 90],
  "1 year": [90, 275],
} as const;
type Range = keyof typeof RANGES;

/** A span's place on the axis, cut to it: the only values set from code. */
const at = (from: number, to: number, start: number, end: number) => {
  const a = Math.min(Math.max(from, start), end);
  const b = Math.min(Math.max(to, start), end);
  return {
    "--from": `${((a - start) / (end - start)) * 100}%`,
    "--width": `${(Math.max(b - a, 0) / (end - start)) * 100}%`,
  } as CSSProperties;
};

const STATE_CLASS: Record<WindowState, string> = {
  ahead: styles.ahead,
  renewing: styles.renewing,
  overdue: styles.overdue,
};

/**
 * The Timeline tab: each certificate a client holds on one axis, its
 * validity a bar and its renewal window (as renewal information tells its
 * client, RFC 9773) a box on it, green ahead, blue open now, red passed
 * without a renewal; today across them all. Soonest window first.
 */
export function RenewalTimeline({
  clients,
  now,
  onOpen,
}: {
  clients: AcmeClient[];
  now: number;
  onOpen: (credentialId: string) => void;
}) {
  const [range, setRange] = useState<Range>("120 days");
  const [before, after] = RANGES[range];
  const start = now - before * DAY;
  const end = now + after * DAY;
  const lanes = clients
    .filter((client) => stateOf(client) === "bound")
    .flatMap((client) =>
      client.certificates.map((certificate) => ({ client, certificate })),
    )
    .sort(
      (a, b) =>
        Date.parse(a.certificate.renewalStart) -
        Date.parse(b.certificate.renewalStart),
    );
  const step = range === "1 year" ? 60 : 30;
  const ticks = Array.from(
    { length: Math.floor((before + after) / step) + 1 },
    (_, i) => -before + i * step,
  ).filter((d) => d > -before && d < after);

  return (
    <Flex vertical>
      <Flex
        justify="space-between"
        align="center"
        gap="middle"
        wrap
        className={styles.filters}
      >
        <Flex gap="middle" wrap className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.validSwatch} />
            Valid
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.windowSwatch} ${styles.ahead}`} />
            Renewal window: its client renews in it
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.windowSwatch} ${styles.renewing}`} />
            Open now
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.windowSwatch} ${styles.overdue}`} />
            Passed, not renewed
          </span>
          <span className={styles.legendItem}>
            <span className={styles.todaySwatch} />
            Today
          </span>
        </Flex>
        <Segmented<Range>
          options={Object.keys(RANGES) as Range[]}
          value={range}
          onChange={setRange}
          aria-label="Range"
        />
      </Flex>
      <div className={styles.timeline} role="list" aria-label="Renewal windows">
        <div className={`${styles.lane} ${styles.laneHead}`} aria-hidden>
          <span>Client</span>
          <div className={styles.axis}>
            {ticks.map((d) => (
              <span
                key={d}
                className={`${styles.tick} ${d === 0 ? styles.tickToday : ""}`}
                style={at(now + d * DAY, now + d * DAY, start, end)}
              >
                {d === 0 ? "Today" : `${d > 0 ? "+" : ""}${d} d`}
              </span>
            ))}
          </div>
          <span>Renewal</span>
        </div>
        {lanes.length === 0 ? (
          <div className={styles.padded}>
            <Typography.Text type="secondary">
              No client holds a certificate yet.
            </Typography.Text>
          </div>
        ) : (
          lanes.map(({ client, certificate }) => {
            const state = windowStateOf(certificate, now);
            const opens = Date.parse(certificate.renewalStart);
            const closes = Date.parse(certificate.renewalEnd);
            const names = certificate.names.join(", ");
            return (
              <div
                key={certificate.certificateId}
                role="listitem"
                className={`${styles.lane} ${STATE_CLASS[state]}`}
              >
                <Flex vertical className={styles.shrink}>
                  <Typography.Link
                    strong
                    ellipsis
                    onClick={() => onOpen(client.credential.id)}
                  >
                    {client.credential.label}
                  </Typography.Link>
                  <Typography.Text
                    type="secondary"
                    className={styles.small}
                    ellipsis={{ tooltip: names }}
                  >
                    {names}
                  </Typography.Text>
                </Flex>
                <div
                  className={styles.track}
                  role="img"
                  aria-label={`${client.credential.label}: valid ${formatDate(certificate.notBefore)} to ${formatDate(certificate.notAfter)}, renews ${formatDate(certificate.renewalStart)} to ${formatDate(certificate.renewalEnd)}`}
                >
                  <Tooltip
                    title={`Valid ${formatDate(certificate.notBefore)} to ${formatDate(certificate.notAfter)}`}
                  >
                    <span
                      className={styles.valid}
                      style={at(
                        Date.parse(certificate.notBefore),
                        Date.parse(certificate.notAfter),
                        start,
                        end,
                      )}
                    />
                  </Tooltip>
                  {opens < end && (
                    <Tooltip
                      title={`Renewal window ${formatDate(certificate.renewalStart)} to ${formatDate(certificate.renewalEnd)}`}
                    >
                      <span
                        className={styles.window}
                        style={at(opens, closes, start, end)}
                      />
                    </Tooltip>
                  )}
                  <span
                    className={styles.today}
                    style={at(now, now, start, end)}
                  />
                </div>
                <Typography.Text
                  className={`${styles.small} ${styles.stateText}`}
                >
                  {state === "overdue"
                    ? `Window passed ${Math.max(1, Math.round((now - closes) / DAY))} d ago`
                    : state === "renewing"
                      ? "In its window now"
                      : `Window in ${Math.max(1, Math.round((opens - now) / DAY))} d`}
                </Typography.Text>
              </div>
            );
          })
        )}
      </div>
    </Flex>
  );
}
