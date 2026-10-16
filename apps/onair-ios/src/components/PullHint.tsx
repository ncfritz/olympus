import { ActivityIndicator, Animated, StyleSheet, Text } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors } from "../theme";
import type { Pull } from "../usePullToRefresh";

/**
 * The pull's hint, over the top of a scroll view: fades in as the pull
 * starts, its arrow turns once letting go would do something, and it stays
 * as "Refreshing…" until the refresh settles.
 */
export function PullHint({ pull, top }: { pull: Pull; top: number }) {
  if (pull.busy) {
    return (
      <Animated.View style={[styles.wrap, { top }]}>
        <Animated.View style={styles.pill} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={styles.label}>Refreshing…</Text>
        </Animated.View>
      </Animated.View>
    );
  }
  const opacity = pull.offset.interpolate({
    inputRange: [-pull.firstAt * 0.75, -8, 0],
    outputRange: [1, 0, 0],
    extrapolate: "clamp",
  });
  const translateY = pull.offset.interpolate({
    inputRange: [-pull.firstAt, 0],
    outputRange: [0, -10],
    extrapolate: "clamp",
  });
  return (
    <Animated.View style={[styles.wrap, { top }]}>
      <Animated.View
        style={[styles.pill, { opacity, transform: [{ translateY }] }]}
      >
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          style={pull.armed ? styles.arrowUp : undefined}
        >
          <Path
            d="M12 4v16M5 13l7 7 7-7"
            stroke={colors.text}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
        <Text style={styles.label}>{pull.label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "none",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(28,30,34,0.92)",
  },
  arrowUp: { transform: [{ rotate: "180deg" }] },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
});
