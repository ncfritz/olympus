import Svg, { Circle, Path } from "react-native-svg";

import type { OnAirStatus } from "../status";
import { statusAccent } from "../theme";

/**
 * Each status has a shape as well as a colour (the design's glyphs), so it
 * reads without colour too: Do Not Disturb filled, Interruptable half,
 * Free a ring, Clear a dashed ring.
 */
export function StatusGlyph({
  status,
  size = 12,
  color = statusAccent[status],
}: {
  status: OnAirStatus;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" accessible={false}>
      {status === "dnd" && <Circle cx={8} cy={8} r={7} fill={color} />}
      {status === "interrupt" && (
        <>
          <Circle
            cx={8}
            cy={8}
            r={6.5}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
          <Path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill={color} />
        </>
      )}
      {status === "free" && (
        <Circle
          cx={8}
          cy={8}
          r={6}
          fill="none"
          stroke={color}
          strokeWidth={2.4}
        />
      )}
      {status === "clear" && (
        <Circle
          cx={8}
          cy={8}
          r={6}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeDasharray="3 2.3"
        />
      )}
    </Svg>
  );
}
