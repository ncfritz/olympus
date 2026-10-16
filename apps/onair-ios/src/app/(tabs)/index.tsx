import { router } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReady } from "../../auth/SessionProvider";
import { CountdownRing } from "../../components/CountdownRing";
import { DayStrip } from "../../components/DayStrip";
import { Glow } from "../../components/Glow";
import { ItemRow, RowSeparator } from "../../components/ItemRow";
import { PillButton } from "../../components/PillButton";
import { StatusGlyph } from "../../components/StatusGlyph";
import { changeHref, hrefOf } from "../../links";
import {
  causeTitle,
  clock,
  countdown,
  dayStrip,
  nowState,
  upNext,
} from "../../schedule";
import { isOnAir, LABELS } from "../../status";
import { colors, statusAccent, statusFill } from "../../theme";
import { useNow } from "../../useNow";
import { usePullToRefresh } from "../../usePullToRefresh";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const noReload = () => Promise.resolve();

export default function NowScreen() {
  const ready = useReady();
  const insets = useSafeAreaInsets();
  const now = useNow(1000);
  const pull = usePullToRefresh(ready?.reload ?? noReload);
  if (ready === undefined) return null;
  const { state, signOut } = ready;

  const current = nowState(state.availability, now);
  const status = current?.status ?? "clear";
  const strip = dayStrip(state.availability.slots, now);
  const next = upNext(state.availability, now);
  const title = causeTitle(current?.cause);
  const onAir = isOnAir(current?.level);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={colors.text}
        />
      }
    >
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Glow color={statusFill[status]} />

        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.date}>
              {`${WEEKDAYS.at(now.getDay())}, ${MONTHS.at(now.getMonth())} ${now.getDate()}`}
            </Text>
            <Text style={styles.title} accessibilityRole="header">
              Now
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <CountdownRing
            progress={current?.progress ?? 0}
            lamp={statusAccent[status]}
            glow={statusAccent[status]}
          >
            <Text style={styles.countdown} accessibilityLabel="Time left">
              {current === undefined
                ? "--:--"
                : countdown(current.until - now.getTime())}
            </Text>
            <Text style={styles.left}>left</Text>
          </CountdownRing>
          <View style={styles.heroText}>
            <View style={styles.onAirRow}>
              <View style={[styles.onAirDot, !onAir && styles.onAirDotOff]} />
              <Text style={styles.onAir}>{onAir ? "ON AIR" : "OFF AIR"}</Text>
            </View>
            <Text style={styles.status}>{LABELS[status]}</Text>
            {title !== undefined && (
              <Text style={styles.heroLine} numberOfLines={1}>
                {title}
              </Text>
            )}
            {current !== undefined && (
              <Text style={styles.heroLine}>
                {`${clock(current.since)} – ${clock(current.until)}`}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.buttons}>
          <View style={styles.button}>
            <PillButton
              label="Change"
              onPress={() => router.push(changeHref(current?.cause))}
            />
          </View>
          <View style={styles.button}>
            <PillButton
              label="Override"
              primary
              onPress={() => router.push("/override/new")}
            />
          </View>
        </View>

        <DayStrip
          parts={strip.parts}
          {...(strip.nowFraction === undefined
            ? {}
            : { nowFraction: strip.nowFraction })}
        />
      </View>

      <View style={styles.body}>
        {current?.next !== undefined && (
          <View style={styles.nextLine}>
            <StatusGlyph status={current.next.status} size={14} />
            <Text style={styles.nextText}>
              {`${LABELS[current.next.status]} at ${clock(current.next.at)}`}
            </Text>
          </View>
        )}

        <Text style={styles.section}>UP NEXT</Text>
        <View style={styles.card}>
          {next.length === 0 ? (
            <Text style={styles.empty}>Nothing else today.</Text>
          ) : (
            next.map((item, index) => (
              <View key={`${item.kind}-${item.id}`}>
                {index > 0 && <RowSeparator />}
                <ItemRow
                  item={item}
                  onPress={() => router.push(hrefOf(item))}
                />
              </View>
            ))
          )}
        </View>

        {state.problem !== undefined && (
          <Text style={styles.problem} accessibilityRole="alert">
            {`${state.problem} Showing what was loaded at ${clock(state.loadedAt)}. Pull down to try again.`}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingBottom: 26, gap: 22 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  titleText: { gap: 2 },
  date: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.85)",
  },
  title: { fontSize: 34, fontWeight: "700", color: colors.text },
  hero: { flexDirection: "row", alignItems: "center", gap: 18 },
  countdown: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  left: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  heroText: { flex: 1, gap: 6 },
  onAirRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  onAirDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  onAirDotOff: { backgroundColor: "rgba(255,255,255,0.4)", shadowOpacity: 0 },
  onAir: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.7,
    color: "#FFFFFF",
  },
  status: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  heroLine: { fontSize: 14, color: "rgba(255,255,255,0.92)" },
  buttons: { flexDirection: "row", gap: 10 },
  button: { flex: 1 },
  body: { paddingHorizontal: 20, gap: 10 },
  nextLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  nextText: { fontSize: 14, color: colors.textSecondary },
  section: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: "hidden",
  },
  empty: { padding: 16, fontSize: 15, color: colors.textSecondary },
  problem: { fontSize: 13, lineHeight: 18, color: "#FF8A8E" },
  signOut: { alignSelf: "flex-start", paddingVertical: 12 },
  signOutText: { fontSize: 15, color: colors.textSecondary },
});
