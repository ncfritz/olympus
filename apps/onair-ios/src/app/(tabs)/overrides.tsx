import { router } from "expo-router";
import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReady } from "../../auth/SessionProvider";
import { ItemRow, RowSeparator } from "../../components/ItemRow";
import { NewOverrideButton } from "../../components/NewOverrideButton";
import { PullHint, PullSpacer } from "../../components/PullHint";
import { hrefOf } from "../../links";
import { dayTitle, overridesByDay } from "../../schedule";
import { colors } from "../../theme";
import { useNow } from "../../useNow";
import { usePullToRefresh } from "../../usePullToRefresh";

const noReload = () => Promise.resolve();

export default function OverridesScreen() {
  const ready = useReady();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const [showing, setShowing] = useState<"upcoming" | "past">("upcoming");
  const pull = usePullToRefresh({
    idleLabel: "Pull to refresh",
    stages: [
      {
        at: 70,
        label: "Release to refresh",
        run: () => (ready?.reload ?? noReload)(),
        spins: true,
      },
    ],
  });
  if (ready === undefined) return null;

  const groups = overridesByDay(ready.state.availability.blocks, now);
  const shown = groups[showing];
  const upcomingCount = groups.upcoming.reduce(
    (count, group) => count + group.items.length,
    0,
  );

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        {...pull.scrollProps}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14 },
        ]}
      >
        <PullSpacer pull={pull} gap={18} />
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.count}>{`${upcomingCount} upcoming`}</Text>
            <Text style={styles.title} accessibilityRole="header">
              Overrides
            </Text>
          </View>
          <NewOverrideButton />
        </View>

        <View style={styles.segmented} accessibilityRole="tablist">
          {(["upcoming", "past"] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: showing === key }}
              onPress={() => setShowing(key)}
              style={[styles.segment, showing === key && styles.segmentOn]}
            >
              <Text
                style={[
                  styles.segmentText,
                  showing === key && styles.segmentTextOn,
                ]}
              >
                {key === "upcoming" ? "Upcoming" : "Past"}
              </Text>
            </Pressable>
          ))}
        </View>

        {shown.length === 0 && (
          <Text style={styles.empty}>
            {showing === "upcoming"
              ? "No overrides coming up. Tap + to set one."
              : "No overrides in the last week."}
          </Text>
        )}

        {shown.map((group) => (
          <View key={group.day.toISOString()} style={styles.group}>
            <Text style={styles.section}>
              {dayTitle(group.day, now).toUpperCase()}
            </Text>
            <View style={styles.card}>
              {group.items.map((item, index) => (
                <View key={item.id}>
                  {index > 0 && <RowSeparator />}
                  <ItemRow
                    item={item}
                    onPress={() => router.push(hrefOf(item))}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </Animated.ScrollView>
      <PullHint pull={pull} top={insets.top + 6} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  titleText: { gap: 2 },
  count: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  title: { fontSize: 34, fontWeight: "700", color: colors.text },
  segmented: {
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentOn: { backgroundColor: "#34363C" },
  segmentText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  segmentTextOn: { color: colors.text },
  empty: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  group: { gap: 8 },
  section: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: "hidden",
  },
});
