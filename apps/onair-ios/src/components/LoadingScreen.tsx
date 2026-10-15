import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

/**
 * The ON AIR loading screen: a lit sign tilted across the screen, its ends
 * past both edges. Static for now; the flicker-on animation is phase 6.
 *
 * With `children` it is the backdrop for a choice instead of a wait (sign
 * in, retry): the progress bar gives way to them.
 */
export function LoadingScreen({
  message = "Syncing your calendars",
  children,
}: {
  message?: string;
  children?: ReactNode;
}) {
  const waiting = children === undefined;
  return (
    <View
      style={styles.screen}
      {...(waiting
        ? {
            accessibilityRole: "progressbar" as const,
            accessibilityLabel: `Loading OnAir. ${message}`,
          }
        : {})}
    >
      <View style={styles.glow} />
      <View style={styles.sign} accessibilityElementsHidden>
        <View style={styles.signFace}>
          <Text style={styles.signText}>ON AIR</Text>
        </View>
      </View>

      <View style={styles.brand}>
        <Text style={styles.brandName}>ONAIR</Text>
        <Text style={styles.brandSub}>Olympus · Minerva</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.message}>{message}</Text>
        {waiting ? (
          <View style={styles.track}>
            <View style={styles.progress} />
          </View>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    left: "-20%",
    right: "-20%",
    top: "30%",
    height: "40%",
    borderRadius: 400,
    backgroundColor: "#3A1214",
    opacity: 0.8,
  },
  sign: {
    position: "absolute",
    alignSelf: "center",
    top: "37%",
    width: 900,
    height: 212,
    borderRadius: 24,
    backgroundColor: "#1B1C1F",
    padding: 16,
    transform: [{ rotate: "-31deg" }],
    shadowColor: "#E5484D",
    shadowOpacity: 0.55,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  signFace: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.signRed,
    alignItems: "center",
    justifyContent: "center",
  },
  signText: {
    fontSize: 100,
    fontWeight: "900",
    letterSpacing: 6,
    color: colors.signText,
    textShadowColor: "#FF8A8E",
    textShadowRadius: 24,
  },
  brand: {
    position: "absolute",
    left: 28,
    top: 96,
    gap: 4,
  },
  brandName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2.3,
    color: "#E5484D",
  },
  brandSub: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  footer: {
    position: "absolute",
    left: 28,
    right: 28,
    bottom: 70,
    gap: 10,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.separator,
    overflow: "hidden",
  },
  progress: {
    width: "62%",
    height: 3,
    backgroundColor: "#E5484D",
  },
});
