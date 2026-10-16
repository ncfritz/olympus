import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { colors } from "../theme";

/**
 * The tab bar's centre button: a raised + that opens New override as a
 * modal. It is a button, not a tab, so the tab you were on stays selected.
 */
export function AddTabButton() {
  return (
    <View style={styles.slot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New override"
        onPress={() => router.push("/override/new")}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
          <Path
            d="M12 5v14M5 12h14"
            stroke={colors.background}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  button: {
    width: 54,
    height: 54,
    marginTop: -14,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
    borderWidth: 4,
    borderColor: colors.tabBar,
  },
  pressed: { opacity: 0.8 },
});
