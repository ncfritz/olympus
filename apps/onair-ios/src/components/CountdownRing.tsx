import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

/**
 * The Now screen's ring: how far through the current status, drawn from the
 * top clockwise, with the lamp and the countdown inside.
 */
export function CountdownRing({
  size = 124,
  stroke = 8,
  progress,
  lamp,
  glow,
  children,
}: {
  size?: number;
  stroke?: number;
  /** 0 to 1. */
  progress: number;
  lamp: string;
  glow: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const lampSize = size * 0.66;
  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <View
        style={[
          styles.lamp,
          {
            width: lampSize,
            height: lampSize,
            borderRadius: lampSize / 2,
            left: (size - lampSize) / 2,
            top: (size - lampSize) / 2,
            backgroundColor: lamp,
            shadowColor: glow,
          },
        ]}
      />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * progress} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: "relative" },
  lamp: {
    position: "absolute",
    shadowOpacity: 0.85,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  center: { alignItems: "center", justifyContent: "center" },
});
