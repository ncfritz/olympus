import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "../theme";

/**
 * The Now header's lamp glow: the status colour spreading from the top left
 * and fading into the background, edge to edge with no corners.
 */
export function Glow({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} accessible={false}>
      <Defs>
        <RadialGradient id="glow" cx="25%" cy="0%" rx="140%" ry="80%">
          <Stop offset="0" stopColor={color} />
          <Stop offset="0.34" stopColor={color} />
          <Stop offset="0.94" stopColor={colors.background} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}
