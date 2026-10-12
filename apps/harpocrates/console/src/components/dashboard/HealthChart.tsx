import { useThemeMode } from "@ncfritz/olympus-console";
import { Flex, theme, Tooltip, Typography } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/accessibility";
import HighchartsReact from "highcharts-react-official";
import { useMemo } from "react";
import type { Dashboard } from "@/lib/api/types";
import { HEALTH_COLORS } from "./chartColors";
import styles from "./Dashboard.module.css";
import { GraphBox } from "./GraphBox";

const SIZE = 140;

/**
 * Valid certificates by whether their renewal is in hand, as a doughnut
 * with the counts beside it, each named: colour never carries it alone.
 */
export function HealthChart({ health }: { health: Dashboard["health"] }) {
  const { token } = theme.useToken();
  const { resolvedMode } = useThemeMode();
  const parts = useMemo(
    () => [
      {
        key: "healthy",
        label: "Healthy",
        count: health.healthy,
        color: HEALTH_COLORS.healthy,
        note: "Not yet at its renewal point",
      },
      {
        key: "renewing",
        label: "Renewing",
        count: health.renewing,
        color: HEALTH_COLORS.renewing[resolvedMode],
        note: "Past its renewal point; something renews it",
      },
      {
        key: "needsPerson",
        label: "Needs a person",
        count: health.needsPerson,
        color: HEALTH_COLORS.needsPerson,
        note: "Past its renewal point, and nothing renews it",
      },
      {
        key: "failing",
        label: "Failing",
        count: health.failing,
        color: HEALTH_COLORS.failing,
        note: "A week or less left, and not renewed",
      },
    ],
    [health, resolvedMode],
  );
  const total = parts.reduce((sum, p) => sum + p.count, 0);

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: {
        type: "pie",
        width: SIZE,
        height: SIZE,
        margin: 0,
        spacing: [0, 0, 0, 0],
        backgroundColor: "transparent",
      },
      title: {
        text: `<b>${total}</b><br/>valid`,
        verticalAlign: "middle",
        y: 6,
        style: { color: token.colorText, fontSize: "14px" },
      },
      credits: { enabled: false },
      legend: { enabled: false },
      accessibility: {
        description: parts.map((p) => `${p.label} ${p.count}`).join(", "),
      },
      tooltip: {
        backgroundColor: token.colorBgElevated,
        borderColor: token.colorBorderSecondary,
        style: { color: token.colorText },
        headerFormat: "",
        pointFormat: "{point.name}: <b>{point.y}</b>",
      },
      plotOptions: {
        pie: {
          innerSize: "70%",
          dataLabels: { enabled: false },
          borderWidth: 2,
          borderColor: token.colorBgContainer,
          animation: false,
        },
      },
      series: [
        {
          type: "pie",
          name: "Certificates",
          data: total
            ? parts.map((p) => ({ name: p.label, y: p.count, color: p.color }))
            : [{ name: "None", y: 1, color: token.colorFillTertiary }],
          enableMouseTracking: total > 0,
        },
      ],
    }),
    [parts, token, total],
  );

  return (
    <GraphBox
      title="Certificates"
      extra={
        <Typography.Text type="secondary" className={styles.small}>
          valid now, by renewal health
        </Typography.Text>
      }
    >
      <Flex gap="middle" align="center">
        <Flex vertical gap="small" className={styles.legend}>
          <div className={styles.tiles}>
            {parts.map((p) => (
              <Tooltip key={p.key} title={p.note}>
                <div className={styles.tile}>
                  <Typography.Text strong className={styles.tileCount}>
                    {p.count}
                  </Typography.Text>
                  <Flex align="center" gap={6} justify="center">
                    <svg width={10} height={10} aria-hidden>
                      <rect width={10} height={10} rx={2} fill={p.color} />
                    </svg>
                    <Typography.Text className={styles.small}>
                      {p.label}
                    </Typography.Text>
                  </Flex>
                </div>
              </Tooltip>
            ))}
          </div>
          <Typography.Text type="secondary" className={styles.small}>
            Healthy: before its renewal point. Renewing: past it, renewing
            itself. Needs a person: nothing renews it. Failing: a week or less
            left.
          </Typography.Text>
        </Flex>
        <div className={styles.ring}>
          <HighchartsReact highcharts={Highcharts} options={options} />
        </div>
      </Flex>
    </GraphBox>
  );
}
