import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, statusFill } from "../theme";

/**
 * The design's rounded button: white for the main action, glass beside it,
 * red for one that destroys something.
 */
export function PillButton({
  label,
  onPress,
  primary = false,
  danger = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
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
        primary ? styles.primary : danger ? styles.danger : styles.secondary,
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
  pressed: { opacity: 0.8 },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  primaryLabel: { color: colors.background },
});
