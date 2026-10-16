import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { PASSCODE_LENGTH } from "../lockRules";
import { colors } from "../theme";

/**
 * Six dots and a number pad, as the iPhone's passcode screen. When the
 * sixth digit goes in, `onComplete` gets the code and the dots clear.
 * `extra` is the key left of 0: Face ID, say.
 */
export function PasscodePad({
  title,
  message,
  disabled = false,
  onComplete,
  extra,
}: {
  title: string;
  message?: string | undefined;
  disabled?: boolean;
  onComplete: (code: string) => void | Promise<void>;
  extra?: { label: string; onPress: () => void } | undefined;
}) {
  const [code, setCode] = useState("");

  const press = (digit: string) => {
    if (disabled || code.length >= PASSCODE_LENGTH) return;
    const next = code + digit;
    setCode(next);
    if (next.length === PASSCODE_LENGTH) {
      void Promise.resolve(onComplete(next)).finally(() => setCode(""));
    }
  };

  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${code.length} of ${PASSCODE_LENGTH} digits entered`}
      >
        {Array.from({ length: PASSCODE_LENGTH }, (_, index) => (
          <View
            key={index}
            style={[styles.dot, index < code.length && styles.dotFilled]}
          />
        ))}
      </View>
      <Text
        style={styles.message}
        accessibilityLiveRegion="polite"
        accessibilityRole={message === undefined ? undefined : "alert"}
      >
        {message ?? " "}
      </Text>

      <View style={styles.pad}>
        {rows.map((row) => (
          <View key={row[0]} style={styles.row}>
            {row.map((digit) => (
              <Key key={digit} label={digit} onPress={() => press(digit)} />
            ))}
          </View>
        ))}
        <View style={styles.row}>
          {extra === undefined ? (
            <View style={styles.key} />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={extra.onPress}
              style={[styles.key, styles.textKey]}
            >
              <Text style={styles.textKeyLabel}>{extra.label}</Text>
            </Pressable>
          )}
          <Key label="0" onPress={() => press("0")} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete"
            onPress={() => setCode(code.slice(0, -1))}
            style={[styles.key, styles.textKey]}
          >
            <Svg width={28} height={22} viewBox="0 0 28 22" accessible={false}>
              <Path
                d="M9 2h15a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9L2 11z M13 7l8 8M21 7l-8 8"
                stroke={colors.text}
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Key({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        styles.digitKey,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.digit}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 18 },
  title: { fontSize: 20, fontWeight: "600", color: colors.text },
  dots: { flexDirection: "row", gap: 18 },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.text,
  },
  dotFilled: { backgroundColor: colors.text },
  message: { minHeight: 20, fontSize: 14, color: "#FF8A8E" },
  pad: { gap: 16, marginTop: 8 },
  row: { flexDirection: "row", gap: 26 },
  key: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  // Dark glass, so the digits read over the red sign behind the lock.
  digitKey: { backgroundColor: "rgba(13,14,16,0.72)" },
  pressed: { backgroundColor: "rgba(60,62,68,0.9)" },
  digit: { fontSize: 34, fontWeight: "400", color: colors.text },
  textKey: { backgroundColor: "transparent" },
  textKeyLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
});
