import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors } from "../theme";

/** The round + beside a screen's title: opens New override. */
export function NewOverrideButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New override"
      onPress={() => router.push("/override/new")}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
        <Path
          d="M12 5v14M5 12h14"
          stroke={colors.text}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8 },
});
