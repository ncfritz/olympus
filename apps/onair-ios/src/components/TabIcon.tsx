import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type TabIconName = "now" | "schedule" | "overrides" | "settings";

/**
 * The tab bar's icons, drawn in the tab's tint: Now a lamp on air, Schedule
 * a calendar, Overrides stacked layers (one set over the calendar), and
 * Settings three sliders.
 */
export function TabIcon({
  name,
  color,
  size = 24,
}: {
  name: TabIconName;
  color: ColorValue;
  size?: number;
}) {
  const line = {
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {name === "now" && (
        <>
          <Circle cx={12} cy={12} r={2.6} fill={color} />
          <Path
            d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 18.7a9.5 9.5 0 0 1 0-13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"
            {...line}
          />
        </>
      )}
      {name === "schedule" && (
        <>
          <Rect x={3.5} y={5} width={17} height={15.5} rx={3} {...line} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...line} />
        </>
      )}
      {name === "overrides" && (
        <>
          <Path d="M12 3.5 20.5 8 12 12.5 3.5 8z" {...line} />
          <Path d="M3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16" {...line} />
        </>
      )}
      {name === "settings" && (
        <>
          <Path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" {...line} />
          <Circle cx={15} cy={6} r={2} {...line} />
          <Circle cx={9} cy={12} r={2} {...line} />
          <Circle cx={17} cy={18} r={2} {...line} />
        </>
      )}
    </Svg>
  );
}
