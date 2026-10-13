import { Descriptions, Flex, Tooltip, Typography } from "antd";
import { type CSSProperties, Fragment, useState } from "react";
import type { SshCa, SshCaActivity } from "@/lib/api/types";
import { timeSince } from "@/lib/dashboard";
import { formatDate } from "@/lib/labels";
import { describeHours } from "@/lib/ssh";
import {
  DAY,
  type Family,
  familyName,
  keyTypeOf,
  PURPOSE,
  rotationOf,
} from "@/lib/sshCas";
import { StatusTag, TypeTag } from "./CaList";
import { Copyable, RotationSteps } from "./CaDetails";
import styles from "./SshCas.module.css";
import { useTypeColors } from "./SshGraphs";

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

/** A swatch's colour. */
const paint = (color: string) => ({ "--color": color }) as CSSProperties;

/**
 * The Timeline tab: each CA's generations on one axis, each signing in
 * its type's colour, and beneath, how long its trust line is needed (until
 * its last certificate expires); its rotations marked, today across them
 * all. A CA chosen is shown beneath, with its rotation step by step.
 */
export function Timeline({
  families,
  cas,
  activity,
  now,
}: {
  families: Family[];
  cas: SshCa[];
  activity: Map<string, SshCaActivity>;
  now: number;
}) {
  const colors = useTypeColors();
  const [chosen, setChosen] = useState<string>();
  const selected =
    families.find((f) => f.key === chosen) ??
    families.find((f) => f.generations.length > 1) ??
    families[0];

  const created = cas.map((ca) => Date.parse(ca.createdAt));
  const start = Math.min(now - 90 * DAY, ...created) - 30 * DAY;
  const end = now + 180 * DAY;
  const months = (end - start) / (30 * DAY);
  const every = months > 30 ? 6 : months > 14 ? 3 : 2;
  const ticks: number[] = [];
  const first = new Date(start);
  first.setDate(1);
  first.setMonth(first.getMonth() + 1);
  for (
    const d = new Date(first);
    d.getTime() < end;
    d.setMonth(d.getMonth() + every)
  ) {
    const t = d.getTime();
    if (Math.abs(t - now) > 20 * DAY) ticks.push(t);
  }

  /** When a generation's line is needed until: undefined while it signs. */
  const neededUntil = (ca: SshCa): number | undefined => {
    if (ca.status === "active") return undefined;
    const last = activity.get(ca.id)?.lastExpiresAt;
    return Math.max(
      Date.parse(ca.retiredAt ?? ca.updatedAt),
      last ? Date.parse(last) : 0,
    );
  };

  return (
    <Flex vertical>
      <Flex gap="middle" wrap className={`${styles.filters} ${styles.legend}`}>
        <span className={styles.legendItem}>
          <span className={styles.swatch} style={paint(colors.user)} />
          User CA signing
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} style={paint(colors.host)} />
          Host CA signing
        </span>
        <span className={styles.legendItem}>
          <span className={styles.trustSwatch} />
          Its trust line needed: until its last certificate expires
        </span>
        <span className={styles.legendItem}>
          <span className={styles.diamondSwatch} />
          Rotation step
        </span>
        <span className={styles.legendItem}>
          <span className={styles.todaySwatch} />
          Today
        </span>
      </Flex>
      <div role="group" aria-label="The CAs' generations">
        <div className={`${styles.lane} ${styles.laneHead}`} aria-hidden>
          <span>CA</span>
          <div className={styles.axis}>
            {ticks.map((t) => (
              <span
                key={t}
                className={styles.tick}
                style={at(t, t, start, end)}
              >
                {new Date(t).toLocaleDateString(undefined, {
                  month: "short",
                  year: "2-digit",
                })}
              </span>
            ))}
            <span
              className={`${styles.tick} ${styles.tickToday}`}
              style={at(now, now, start, end)}
            >
              Today
            </span>
          </div>
        </div>
        {families.map((family) => {
          const color = colors[family.type];
          const oldest = [...family.generations].reverse();
          return (
            <Fragment key={family.key}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={family === selected}
                className={`${styles.lane} ${family === selected ? styles.laneOn : ""}`}
                onClick={() => setChosen(family.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setChosen(family.key);
                  }
                }}
              >
                <Flex vertical className={styles.shrink}>
                  <Typography.Text strong>{familyName(family)}</Typography.Text>
                  <Typography.Text type="secondary" className={styles.small}>
                    {PURPOSE[family.type]}
                  </Typography.Text>
                </Flex>
                <div className={styles.laneTrack}>
                  {oldest.map((ca) => {
                    const from = Date.parse(ca.createdAt);
                    const to = ca.retiredAt ? Date.parse(ca.retiredAt) : end;
                    return (
                      <Tooltip
                        key={ca.id}
                        title={`G${ca.generation} signs from ${formatDate(ca.createdAt)}${ca.retiredAt ? ` to ${formatDate(ca.retiredAt)}` : ""}`}
                      >
                        <span
                          className={`${styles.span} ${ca.retiredAt ? "" : styles.open}`}
                          style={at(from, to, start, end, color)}
                        >
                          G{ca.generation} signing
                        </span>
                      </Tooltip>
                    );
                  })}
                  {oldest.flatMap((ca) => [
                    ...(ca.generation > 1
                      ? [
                          <Tooltip
                            key={`${ca.id}-made`}
                            title={`Rotated: G${ca.generation} made ${formatDate(ca.createdAt)}`}
                          >
                            <i
                              className={styles.diamond}
                              style={at(
                                Date.parse(ca.createdAt),
                                Date.parse(ca.createdAt),
                                start,
                                end,
                              )}
                            />
                          </Tooltip>,
                        ]
                      : []),
                    ...(ca.retiredAt
                      ? [
                          <Tooltip
                            key={`${ca.id}-retired`}
                            title={`G${ca.generation} retired ${formatDate(ca.retiredAt)}`}
                          >
                            <i
                              className={styles.diamond}
                              style={at(
                                Date.parse(ca.retiredAt),
                                Date.parse(ca.retiredAt),
                                start,
                                end,
                              )}
                            />
                          </Tooltip>,
                        ]
                      : []),
                  ])}
                  <span
                    className={styles.today}
                    style={at(now, now, start, end)}
                  />
                </div>
              </div>
              <div className={`${styles.lane} ${styles.laneSub}`}>
                <Typography.Text type="secondary" className={styles.small}>
                  {family.type === "user"
                    ? "Trusted on hosts: TrustedUserCAKeys"
                    : "Trusted on clients: known_hosts"}
                </Typography.Text>
                <div className={styles.laneTrack}>
                  {oldest.map((ca) => {
                    const until = neededUntil(ca);
                    return (
                      <Tooltip
                        key={ca.id}
                        title={
                          until === undefined
                            ? `G${ca.generation}'s line: needed while it signs`
                            : until > now
                              ? `G${ca.generation}'s line: needed until ${formatDate(new Date(until).toISOString())}, when its last certificate expires`
                              : `G${ca.generation}'s line: not needed since ${formatDate(new Date(until).toISOString())}; take it out`
                        }
                      >
                        <span
                          className={`${styles.span} ${styles.trustSpan} ${until === undefined ? styles.open : ""}`}
                          style={at(
                            Date.parse(ca.createdAt),
                            until ?? end,
                            start,
                            end,
                          )}
                        >
                          G{ca.generation} line
                        </span>
                      </Tooltip>
                    );
                  })}
                  <span
                    className={styles.today}
                    style={at(now, now, start, end)}
                  />
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      {selected && (
        <Chosen family={selected} cas={cas} activity={activity} now={now} />
      )}
    </Flex>
  );
}

/** The CA chosen: its newest generation, and its rotation step by step. */
function Chosen({
  family,
  cas,
  activity,
  now,
}: {
  family: Family;
  cas: SshCa[];
  activity: Map<string, SshCaActivity>;
  now: number;
}) {
  const ca = family.current ?? family.generations[0];
  const counts = activity.get(ca.id);
  const steps = rotationOf(family, activity, now);
  return (
    <div className={styles.detail}>
      <div className={styles.box}>
        <Flex justify="space-between" align="center" gap="small" wrap>
          <Typography.Text strong className={styles.boxTitle}>
            {ca.name}
          </Typography.Text>
          <Flex gap={4}>
            <StatusTag ca={ca} cas={cas} />
            <TypeTag ca={ca} />
          </Flex>
        </Flex>
        <Descriptions
          column={1}
          size="small"
          items={[
            {
              key: "id",
              label: "ID",
              children: <span className={styles.mono}>{ca.id}</span>,
            },
            { key: "key", label: "Key", children: keyTypeOf(ca) },
            {
              key: "longest",
              label: "Longest",
              children: describeHours(ca.maxValidityHours),
            },
            {
              key: "certificates",
              label: "Certificates",
              children: `${counts?.valid ?? 0} valid · ${(counts?.issuedEver ?? 0).toLocaleString()} issued · ${counts?.inKrl ?? 0} in its KRL`,
            },
            {
              key: "krl",
              label: "KRL",
              children: ca.krlDueAt
                ? "A new one is due"
                : ca.krlPublishedAt
                  ? `Version ${ca.krlVersion}, published ${timeSince(ca.krlPublishedAt, now)}`
                  : "Not yet published",
            },
          ]}
        />
        <Typography.Text className={styles.label}>Trust line</Typography.Text>
        <Copyable text={ca.trustLine} />
      </div>
      <div className={styles.box}>
        <Typography.Text strong className={styles.boxTitle}>
          Rotating, step by step
        </Typography.Text>
        {steps ? (
          <RotationSteps steps={steps} />
        ) : (
          <Typography.Text type="secondary">
            One generation so far: G{ca.generation}, since{" "}
            {formatDate(ca.createdAt)}.
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
