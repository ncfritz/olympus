import type {
  MailCluster,
  MailClusterPoint,
} from "@ncfritz/olympus-sdk/minerva";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import React, { useMemo } from "react";
import { pointGroups, type MapPoint } from "../../../../utils/mailClusters";
import { baseChart } from "../statistics/charts";

export interface ClusterMapProps {
  clusters: MailCluster[];
  points: MailClusterPoint[];
  selectedId?: string;
  onSelect: (clusterId: string) => void;
  height?: number;
}

/** How many clusters are named on the map, largest and suggesting first. */
const NAMED = 15;

/**
 * The mailbox as a map (docs/plans/email-management phase 6): a dot per
 * about 50 messages, placed by similarity and coloured by label, the
 * largest clusters named where they sit. A dot or a name selects its
 * cluster; the selected cluster's dots stand out.
 */
const ClusterMap: React.FunctionComponent<ClusterMapProps> = ({
  clusters,
  points,
  selectedId,
  onSelect,
  height = 560,
}) => {
  const options = useMemo<Highcharts.Options>(() => {
    const groups = pointGroups(points);
    const named = [...clusters]
      .sort(
        (a, b) =>
          Number(!!b.suggestion) - Number(!!a.suggestion) || b.size - a.size,
      )
      .slice(0, NAMED);
    if (selectedId && !named.some((c) => c.id === selectedId)) {
      const selected = clusters.find((c) => c.id === selectedId);
      if (selected) named.push(selected);
    }
    const select = function (this: Highcharts.Point) {
      const id = (this.options as { clusterId?: string }).clusterId;
      if (id) onSelect(id);
    };
    const faded = selectedId !== undefined;
    return {
      ...baseChart(height),
      chart: {
        ...baseChart(height).chart,
        type: "scatter",
        zooming: { type: "xy" },
      },
      legend: { enabled: true, itemStyle: { fontWeight: "normal" } },
      xAxis: { visible: false, min: 0, max: 1 },
      yAxis: { visible: false, min: 0, max: 1, reversed: true },
      tooltip: {
        formatter: function () {
          const p = (
            this as unknown as {
              point: { options: MapPoint & { centre?: boolean } };
            }
          ).point.options;
          const cluster = clusters.find((c) => c.id === p.clusterId);
          if (p.centre && cluster) {
            return `<b>${cluster.name}</b><br/>${cluster.size.toLocaleString()} messages`;
          }
          return `${p.label ?? "No label"}${
            cluster ? `<br/>In <b>${cluster.name}</b>` : ""
          }`;
        },
      },
      plotOptions: {
        series: {
          turboThreshold: 0,
          cursor: "pointer",
          point: { events: { click: select } },
          states: { inactive: { enabled: false } },
        },
        scatter: { marker: { radius: 2.5, symbol: "circle" } },
      },
      series: [
        ...groups.map((g): Highcharts.SeriesScatterOptions => ({
          type: "scatter",
          name: g.name,
          color: g.color,
          opacity: faded ? 0.35 : 0.8,
          data: g.points,
        })),
        ...(selectedId
          ? [
              {
                type: "scatter" as const,
                name: "Selected cluster",
                color: "#111827",
                marker: { radius: 3.5 },
                data: groups
                  .flatMap((g) => g.points)
                  .filter((p) => p.clusterId === selectedId),
              },
            ]
          : []),
        {
          type: "scatter",
          name: "Clusters",
          showInLegend: false,
          enableMouseTracking: true,
          marker: { enabled: false },
          data: named.map((c) => ({
            x: c.x,
            y: c.y,
            clusterId: c.id,
            centre: true,
            dataLabels: {
              enabled: true,
              format: c.name,
              style: {
                fontSize: "11px",
                fontWeight: c.id === selectedId ? "bold" : "normal",
                textOutline: "2px white",
              },
            },
          })),
        },
      ],
    };
  }, [clusters, points, selectedId, onSelect, height]);

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export default ClusterMap;
