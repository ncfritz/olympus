import * as React from "react";

interface DayProps {
  day: number;
  types: Record<number, any>;
}

enum CalculationMode {
  total,
  percent,
}

const RADIUS = 17.91549430918954;
const MAX_MEETING_MIN = 8 * 60;

const Day: React.FunctionComponent<DayProps> = ({ day, types }: DayProps) => {
  const colors: Record<string, string> = {
    Free: "#32485c",
    Busy: "#67598c",
    Tentative: "#c05a91",
    OOF: "#df5b84",
    WorkingElsewhere: "#ff7356",
    NoData: "#ffa600",
  };

  const segments = [];
  let stroke = 0;
  let total = 0;

  if (types) {
    for (const k in types) {
      total += types[k].totalDurationMin;
    }

    if (total > 0) {
      const mode =
        total >= MAX_MEETING_MIN
          ? CalculationMode.percent
          : CalculationMode.total;

      stroke = 4;

      let offset = 0;

      for (const k in types) {
        const current = types[k];
        let percent;

        if (mode == CalculationMode.percent) {
          percent = 100 * (current.totalDurationMin / total);
        } else {
          percent = 100 * (current.totalDurationMin / MAX_MEETING_MIN);
        }

        segments.push(
          <circle
            className="donut-segment"
            key={"d-" + day + "-s-" + k}
            cx="21"
            cy="21"
            r={RADIUS}
            fill="transparent"
            stroke={colors[k]}
            strokeWidth={stroke}
            strokeDasharray={percent + " " + (100 - percent)}
            strokeDashoffset={offset}
          />,
        );

        offset = 100 - percent + offset;
      }
    }
  }

  return (
    <svg
      width="28px"
      height="28px"
      viewBox="0 0 42 42"
      className={"donut" + (total > 0) ? " actionable" : ""}
    >
      <circle cx="21" cy="21" r={RADIUS} fill="transparent" />
      <circle
        cx="21"
        cy="21"
        r={RADIUS}
        fill="transparent"
        strokeWidth={stroke}
      />
      {segments}
      <g className="chart-text">
        <text x="50%" y="50%" className="chart-number">
          {day}
        </text>
      </g>
    </svg>
  );
};
export default Day;
