import type {
  MailCluster,
  MailClusterPoint,
} from "@ncfritz/olympus-sdk/minerva";
import { ZoomOutOutlined } from "@ant-design/icons";
import { Button, Flex, Typography } from "antd";
import Highcharts from "highcharts";
import "highcharts/modules/mouse-wheel-zoom";
import HighchartsReact from "highcharts-react-official";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { pointGroups, type MapPoint } from "../../../../utils/mailClusters";
import { baseChart } from "../statistics/charts";

const { Text } = Typography;

export interface ClusterMapProps {
  clusters: MailCluster[];
  points: MailClusterPoint[];
  selectedId?: string;
  /** A cluster chosen: its dot or name clicked. */
  onSelect: (clusterId: string) => void;
  /** The selection dropped: the selected cluster or the map's ground clicked. */
  onClear: () => void;
  height?: number;
}

/** The map's view when zoomed: each axis's extremes. */
type Zoom = { x: [number, number]; y: [number, number] };

/** How long a zoom settles before the map keeps it, in ms. */
const ZOOM_SETTLE = 250;

/** How many clusters are named on the map, largest and suggesting first. */
const NAMED = 15;

/**
 * The mailbox as a map (docs/plans/email-management phase 6): a dot per
 * about 50 messages, placed by similarity and coloured by label, the
 * largest clusters named where they sit. A dot or a name selects its
 * cluster, and again drops it, as does a click on the map's ground; the
 * selected cluster's dots stand out. The map zooms with the wheel or a
 * drag, pans with shift and a drag, and keeps its zoom as the selection
 * changes.
 */
const ClusterMap: React.FunctionComponent<ClusterMapProps> = ({
  clusters,
  points,
  selectedId,
  onSelect,
  onClear,
  height = 560,
}) => {
  const [zoom, setZoom] = useState<Zoom>();
  const chart = useRef<HighchartsReact.RefObject>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(settle.current), []);
  // A new map (another mailbox, another run) starts unzoomed.
  useEffect(() => setZoom(undefined), [points]);

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
      if (!id) return;
      if (id === selectedId) onClear();
      else onSelect(id);
    };
    // The user zoomed, panned or reset: the view is kept once it settles,
    // so a new selection redraws the map where it is. The map's own
    // redraws (no trigger) are passed over.
    const keep = function (
      this: Highcharts.Axis,
      e: Highcharts.AxisSetExtremesEventObject,
    ) {
      if (!(e as { trigger?: string }).trigger) return;
      const chart = this.chart;
      clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        const x = chart.xAxis[0].getExtremes();
        const y = chart.yAxis[0].getExtremes();
        const zoomed =
          x.userMin !== undefined ||
          x.userMax !== undefined ||
          y.userMin !== undefined ||
          y.userMax !== undefined;
        setZoom(zoomed ? { x: [x.min, x.max], y: [y.min, y.max] } : undefined);
      }, ZOOM_SETTLE);
    };
    const faded = selectedId !== undefined;
    return {
      ...baseChart(height),
      chart: {
        ...baseChart(height).chart,
        type: "scatter",
        zooming: {
          type: "xy",
          mouseWheel: { enabled: true, sensitivity: 1.1 },
        },
        panning: { enabled: true, type: "xy" },
        panKey: "shift",
        events: {
          // A click on the map's ground, not on a dot or a name.
          click: () => {
            if (selectedId) onClear();
          },
        },
      },
      legend: { enabled: true, itemStyle: { fontWeight: "normal" } },
      xAxis: {
        visible: false,
        min: zoom?.x[0] ?? 0,
        max: zoom?.x[1] ?? 1,
        events: { afterSetExtremes: keep },
      },
      yAxis: {
        visible: false,
        min: zoom?.y[0] ?? 0,
        max: zoom?.y[1] ?? 1,
        reversed: true,
        events: { afterSetExtremes: keep },
      },
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
        // Each series has an id, so an update matches it by id rather than
        // by place: the selected cluster's series comes and goes between
        // the label groups and the names without taking their options.
        ...groups.map((g): Highcharts.SeriesScatterOptions => ({
          type: "scatter",
          id: `group:${g.name}`,
          name: g.name,
          color: g.color,
          opacity: faded ? 0.35 : 0.8,
          data: g.points,
        })),
        ...(selectedId
          ? [
              {
                type: "scatter" as const,
                id: "selected",
                name: "Selected cluster",
                // At once: a selection is not a reveal.
                animation: false,
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
          id: "clusters",
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
  }, [clusters, points, selectedId, onSelect, onClear, height, zoom]);

  return (
    <Flex vertical={true} gap={4}>
      <Flex justify={"space-between"} align={"center"} gap={8}>
        <Text type={"secondary"} style={{ fontSize: 12 }}>
          Scroll or drag to zoom, shift and drag to pan; click a cluster again,
          or the map, to clear it.
        </Text>
        <Button
          size={"small"}
          icon={<ZoomOutOutlined />}
          disabled={!zoom}
          onClick={() => {
            // Highcharts keeps its own zoom over the axes' range: its
            // zoom-out clears that, and the view kept with it.
            chart.current?.chart.zoomOut();
            setZoom(undefined);
          }}
        >
          Reset zoom
        </Button>
      </Flex>
      <HighchartsReact
        ref={chart}
        highcharts={Highcharts}
        options={options}
        // One to one, so the selected cluster's series is added and dropped
        // with the selection rather than ignored.
        updateArgs={[true, true, false]}
      />
    </Flex>
  );
};

export default ClusterMap;
