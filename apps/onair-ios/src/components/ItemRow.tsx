import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";

import { clock, type Item } from "../schedule";
import { LABELS } from "../status";
import { colors, statusAccent } from "../theme";

/**
 * A meeting or an override in a list: its status as the cell's left border
 * (striped for an override, as the canvas draws them), its time, title and
 * why it is that status.
 */
export function ItemRow({
  item,
  onPress,
  showTime = true,
}: {
  item: Item;
  onPress: () => void;
  showTime?: boolean;
}) {
  const color = statusAccent[item.status];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${clock(item.start)}, ${item.title}, ${LABELS[item.status]}. ${item.detail}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {item.kind === "block" ? (
        <Svg style={styles.border} accessible={false}>
          <Defs>
            <Pattern
              id={`stripe-${item.id}`}
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <Rect width="8" height="4" fill={color} />
              <Rect y="4" width="8" height="4" fill={color} opacity={0.35} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#stripe-${item.id})`} />
        </Svg>
      ) : (
        <View style={[styles.border, { backgroundColor: color }]} />
      )}
      {showTime && <Text style={styles.time}>{clock(item.start)}</Text>}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {item.detail}
        </Text>
      </View>
    </Pressable>
  );
}

/** The rule between rows in a card. */
export function RowSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 16,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  border: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  time: {
    width: 44,
    fontSize: 13,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "600", color: colors.text },
  detail: { fontSize: 13, color: colors.textSecondary },
  separator: { height: 1, backgroundColor: colors.separator, marginLeft: 20 },
});
