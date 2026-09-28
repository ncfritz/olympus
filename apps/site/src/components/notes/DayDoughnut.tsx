import * as React from "react";

interface DayProps {
  day: number;
  types: Record<number, number>;
}

const RADIUS = 17.91549430918954;

const Day: React.FunctionComponent<DayProps> = ({ day, types }: DayProps) => {
  const colors: Record<string, string> = {
    note: "#32485c",
    idea: "#67598c",
    thought: "#c05a91",
    action: "#df5b84",
    praise: "#ff7356",
    question: "#ffa600",
  };

  const segments = [];
  let stroke = 0;
  let count = 0;

  if (types) {
    for (const k in types) {
      if (k == "total") {
        continue;
      }

      count += types[k];
    }

    if (count > 0) {
      stroke = 4;

      let offset = 0;

      for (const k in types) {
        const current = types[k];
        const percent = 100 * (current / count);

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
      className={"donut" + (count > 0) ? " actionable" : ""}
    >
      <circle cx="21" cy="21" r={RADIUS} fill="transparent" />
      <circle
        cx="21"
        cy="21"
        r={RADIUS}
        fill="transparent"
        stroke="#d2d3d4"
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
