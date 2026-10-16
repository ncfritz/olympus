import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, statusFill } from "../theme";

/**
 * The design's rounded button: white for the main action, glass beside it
 * (a brighter glass when `emphasis`), red for one that destroys something,
 * or text alone when `plain`.
 */
export function PillButton({
  label,
  onPress,
  primary = false,
  danger = false,
  emphasis = false,
  plain = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  emphasis?: boolean;
  plain?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        primary
          ? styles.primary
          : danger
            ? styles.danger
            : emphasis
              ? styles.emphasis
              : plain
                ? styles.plain
                : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.background : colors.text} />
      ) : (
        <Text style={[styles.label, primary && styles.primaryLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: "#FFFFFF" },
  secondary: { backgroundColor: "rgba(255,255,255,0.14)" },
  danger: { backgroundColor: statusFill.dnd },
  emphasis: { backgroundColor: "rgba(255,255,255,0.26)" },
  plain: { backgroundColor: "transparent" },
  pressed: { opacity: 0.8 },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  primaryLabel: { color: colors.background },
});
