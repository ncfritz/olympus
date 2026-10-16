import { StyleSheet, Text, View } from "react-native";

import type { StripPart } from "../schedule";
import { longTime, shortTime, type WorkSettings } from "../settings";
import { colors, statusAccent } from "../theme";

/** Today's working day as coloured parts, with a white mark at now. */
export function DayStrip({
  parts,
  nowFraction,
  settings,
}: {
  parts: StripPart[];
  nowFraction?: number;
  settings: WorkSettings;
}) {
  // Start, the hour nearest the middle, and end.
  const middle =
    Math.round((settings.dayStart + settings.dayEnd) / 2 / 60) * 60;
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Today's status from ${longTime(settings.dayStart)} to ${longTime(settings.dayEnd)}`}
    >
      <View style={styles.strip}>
        {parts.map((part, index) => (
          <View
            key={index}
            style={[
              styles.part,
              {
                flex: part.fraction,
                backgroundColor:
                  part.status === "clear"
                    ? colors.separator
                    : statusAccent[part.status],
              },
            ]}
          />
        ))}
        {nowFraction !== undefined && (
          <View style={[styles.now, { left: `${nowFraction * 100}%` }]} />
        )}
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>{shortTime(settings.dayStart)}</Text>
        <Text style={styles.label}>{shortTime(middle)}</Text>
        <Text style={styles.label}>{shortTime(settings.dayEnd)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  strip: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    flexDirection: "row",
    gap: 2,
  },
  part: { alignSelf: "stretch" },
  now: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 3,
    marginLeft: -1.5,
    backgroundColor: "#FFFFFF",
  },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 11, color: colors.textSecondary },
});
