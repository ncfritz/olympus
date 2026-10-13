import { Flex, Typography } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import { type CSSProperties, useMemo } from "react";
import type { SshActivityCertificate } from "@/lib/api/types";
import {
  ACTIVITY_DAYS,
  DAY,
  formatLeft,
  holderOf,
  issuedByDay,
  KRL_DAYS,
  krlByDay,
  principalsSigned,
  validNow,
} from "@/lib/sshCas";
import { CATEGORICAL, HEALTH_COLORS } from "../../dashboard/chartColors";
import { baseOptions, useChartTheme } from "../../dashboard/chartTheme";
import { GraphBox } from "../../dashboard/GraphBox";
import styles from "./SshCas.module.css";

/** The types' colours: the palette's first two slots. */
export const useTypeColors = () => {
  const { mode } = useChartTheme();
  return useMemo(
    () => ({ user: CATEGORICAL[mode][0], host: CATEGORICAL[mode][1] }),
    [mode],
  );
};

const Swatch = ({ color, label }: { color: string; label: string }) => (
  <span className={styles.legendItem}>
    <svg width={10} height={10} aria-hidden>
      <rect width={10} height={10} rx={2} fill={color} />
    </svg>
    {label}
  </span>
);

const dayLabel = (day: number) =>
  new Date(day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

/**
 * The graphs above the tabs: the certificates issued each day, users' and
 * hosts', and the KRLs' entries over the last 90 days.
 */
export function SshGraphs({
  certificates,
  now,
}: {
  certificates: SshActivityCertificate[];
  now: number;
}) {
  return (
    <div className={styles.graphs}>
      <IssuedByDay certificates={certificates} now={now} />
      <Revocations certificates={certificates} now={now} />
    </div>
  );
}

function IssuedByDay({
  certificates,
  now,
}: {
  certificates: SshActivityCertificate[];
  now: number;
}) {
  const { token } = useChartTheme();
  const colors = useTypeColors();
  const days = useMemo(
    () => issuedByDay(certificates, ACTIVITY_DAYS, now),
    [certificates, now],
  );
  const options = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: { ...base.chart, type: "column", height: 170 },
      accessibility: {
        description: days
          .map((d) => `${dayLabel(d.day)}: ${d.user} user, ${d.host} host`)
          .join("; "),
      },
      xAxis: {
        ...base.xAxis,
        categories: days.map((d, i) =>
          i === days.length - 1 ? "Today" : i % 7 === 0 ? dayLabel(d.day) : "",
        ),
        labels: {
          autoRotation: [0],
          style: { color: token.colorTextSecondary, fontSize: "11px" },
        },
      },
      yAxis: { ...base.yAxis, reversedStacks: false },
      tooltip: { ...base.tooltip, shared: true, headerFormat: "" },
      plotOptions: {
        column: {
          stacking: "normal",
          borderRadius: 2,
          borderWidth: 1,
          borderColor: token.colorBgContainer,
          animation: false,
          groupPadding: 0.08,
        },
      },
      series: (["user", "host"] as const).map((type) => ({
        type: "column" as const,
        name: type === "user" ? "User" : "Host",
        color: colors[type],
        data: days.map((d) => d[type]),
      })),
    };
  }, [days, colors, token]);
  return (
    <GraphBox
      title="Issued each day"
      extra={
        <Flex gap="middle" className={styles.legend}>
          <Swatch color={colors.user} label="User" />
          <Swatch color={colors.host} label="Host" />
        </Flex>
      }
    >
      <HighchartsReact highcharts={Highcharts} options={options} />
    </GraphBox>
  );
}

/** The KRLs' entries at each day's end, and the revocations that day. */
function Revocations({
  certificates,
  now,
}: {
  certificates: SshActivityCertificate[];
  now: number;
}) {
  const { token } = useChartTheme();
  const colors = useTypeColors();
  const days = useMemo(
    () => krlByDay(certificates, KRL_DAYS, now),
    [certificates, now],
  );
  const year = certificates.filter(
    (c) => c.revokedAt && Date.parse(c.revokedAt) > now - 365 * DAY,
  );
  const last = year.reduce<SshActivityCertificate | undefined>(
    (latest, c) =>
      !latest || Date.parse(c.revokedAt!) > Date.parse(latest.revokedAt!)
        ? c
        : latest,
    undefined,
  );
  const options = useMemo((): Highcharts.Options => {
    const base = baseOptions(token);
    return {
      ...base,
      chart: { ...base.chart, height: 170 },
      accessibility: {
        description: `Entries in the KRLs over ${KRL_DAYS} days; ${days.reduce((s, d) => s + d.revoked, 0)} revocations`,
      },
      xAxis: {
        ...base.xAxis,
        categories: days.map((d, i) =>
          i === days.length - 1 ? "Today" : i % 14 === 0 ? dayLabel(d.day) : "",
        ),
        labels: {
          autoRotation: [0],
          style: { color: token.colorTextSecondary, fontSize: "11px" },
        },
      },
      yAxis: { ...base.yAxis, reversedStacks: false, min: 0, minRange: 2 },
      tooltip: { ...base.tooltip, shared: true, headerFormat: "" },
      plotOptions: {
        area: {
          stacking: "normal",
          step: "left",
          animation: false,
          marker: { enabled: false },
          fillOpacity: 0.35,
          lineWidth: 1.5,
        },
        scatter: { animation: false },
      },
      series: [
        ...(["user", "host"] as const).map((type) => ({
          type: "area" as const,
          name: `${type === "user" ? "User" : "Host"} entries`,
          color: colors[type],
          data: days.map((d) => d[type]),
        })),
        {
          type: "scatter" as const,
          name: "Revoked that day",
          color: HEALTH_COLORS.failing,
          marker: { symbol: "diamond", radius: 5 },
          data: days.map((d, i) => (d.revoked ? [i, d.user + d.host] : null)),
        },
      ],
    };
  }, [days, colors, token]);
  return (
    <GraphBox
      title="Revocations in the KRLs"
      extra={
        <Flex gap="middle" className={styles.legend}>
          <Swatch color={colors.user} label="User" />
          <Swatch color={colors.host} label="Host" />
          <Swatch color={HEALTH_COLORS.failing} label="Revoked" />
        </Flex>
      }
    >
      <HighchartsReact highcharts={Highcharts} options={options} />
      <Typography.Text type="secondary" className={styles.small}>
        A revoked certificate stays in its KRL until it expires.{" "}
        {year.length === 0
          ? "None revoked in a year."
          : `${year.length} revoked in a year; the last, ${holderOf(last!)}, on ${new Date(Date.parse(last!.revokedAt!)).toLocaleDateString()}.`}
      </Typography.Text>
    </GraphBox>
  );
}

/** A bar's length and colour: the only values set from code. */
const fill = (share: number, color: string) =>
  ({
    "--width": `${Math.max(0, Math.min(1, share)) * 100}%`,
    "--color": color,
  }) as CSSProperties;

/** The Authorities tab's graphs: time left on what is valid, and principals. */
export function AuthorityGraphs({
  certificates,
  since,
  now,
}: {
  certificates: SshActivityCertificate[];
  since: number;
  now: number;
}) {
  const colors = useTypeColors();
  const { mode } = useChartTheme();
  const valid = validNow(certificates, now);
  const shown = valid.slice(0, 12);
  const principals = principalsSigned(certificates, since).slice(0, 8);
  const most = Math.max(1, ...principals.map((p) => p.count));
  return (
    <div className={styles.graphs}>
      <GraphBox
        title="Valid now, time left"
        extra={
          <Typography.Text type="secondary" className={styles.small}>
            {valid.length > shown.length
              ? `The ${shown.length} with the least of ${valid.length}`
              : `${valid.length} valid`}
          </Typography.Text>
        }
      >
        {shown.length === 0 ? (
          <Typography.Text type="secondary">
            No SSH certificate is valid now.
          </Typography.Text>
        ) : (
          <Flex vertical gap={6}>
            {shown.map((c) => (
              <div key={c.id} className={styles.barRow}>
                <Typography.Text
                  className={styles.small}
                  ellipsis={{ tooltip: c.principals.join(", ") }}
                >
                  {holderOf(c)}
                </Typography.Text>
                <div
                  className={styles.track}
                  role="img"
                  aria-label={`${holderOf(c)}: ${formatLeft(c.left)} left`}
                >
                  <span
                    className={`${styles.fill} ${c.share < 0.15 ? styles.low : ""}`}
                    style={fill(c.share, colors[c.type])}
                  />
                </div>
                <Typography.Text
                  type="secondary"
                  className={`${styles.small} ${styles.right}`}
                >
                  {formatLeft(c.left)}
                </Typography.Text>
              </div>
            ))}
          </Flex>
        )}
      </GraphBox>
      <GraphBox title={`Principals signed, ${ACTIVITY_DAYS} days`}>
        {principals.length === 0 ? (
          <Typography.Text type="secondary">
            No user certificate in {ACTIVITY_DAYS} days.
          </Typography.Text>
        ) : (
          <Flex vertical gap={6}>
            {principals.map((p) => (
              <div key={p.principal} className={styles.barRow}>
                <Typography.Text className={`${styles.small} ${styles.mono}`}>
                  {p.principal}
                </Typography.Text>
                <div className={styles.track} aria-hidden>
                  <span
                    className={styles.fill}
                    style={fill(p.count / most, CATEGORICAL[mode][2])}
                  />
                </div>
                <Typography.Text
                  strong
                  className={`${styles.small} ${styles.right}`}
                >
                  {p.count}
                </Typography.Text>
              </div>
            ))}
          </Flex>
        )}
      </GraphBox>
    </div>
  );
}
