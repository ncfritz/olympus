import { sparkline, type SparkPoint } from "../../../utils/stations";

export interface SparklineProps {
  points: SparkPoint[];
  from: number;
  to: number;
  /** A stretch longer than this without a point breaks the line. */
  maxGapMs: number;
  label: string;
  width?: number;
  height?: number;
}

/** A small line of one series over a time range, with gaps left as gaps. */
const Sparkline: React.FunctionComponent<SparklineProps> = ({
  points,
  from,
  to,
  maxGapMs,
  label,
  width = 300,
  height = 44,
}: SparklineProps) => (
  <svg
    width="100%"
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none"
    role="img"
    aria-label={label}
  >
    {sparkline(points, from, to, width, height, maxGapMs).map((line) => (
      <polyline
        key={line}
        points={line}
        fill="none"
        stroke="#1677ff"
        strokeWidth={1.6}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    ))}
  </svg>
);

export default Sparkline;
