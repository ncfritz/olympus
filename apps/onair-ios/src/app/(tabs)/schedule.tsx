import { router } from "expo-router";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  type ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useReady } from "../../auth/SessionProvider";
import { ItemRow, RowSeparator } from "../../components/ItemRow";
import { PullHint } from "../../components/PullHint";
import { StatusGlyph } from "../../components/StatusGlyph";
import { hrefOf } from "../../links";
import {
  addDays,
  allDayOn,
  clock,
  itemsBetween,
  layoutColumns,
  loadWindow,
  sameDay,
  segments,
  startOfDay,
  weekOf,
} from "../../schedule";
import { LABELS, STATUSES, toOnAirStatus } from "../../status";
import { colors, statusAccent } from "../../theme";
import { useNow } from "../../useNow";
import { usePullToRefresh } from "../../usePullToRefresh";

/** Points per hour on the day's timeline. */
const HOUR = 60;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const DAY_LETTERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const RAIL_LEFT = 46;
const EVENTS_LEFT = 60;
/** Room above midnight so the 12 AM label is not cut off. */
const GRID_TOP = 10;
/** The "3 all-day events" row above midnight, margins included. */
const SUMMARY_HEIGHT = 34;
/** The gap under the open all-day list. */
const ALL_DAY_GAP = 8;

const noReload = () => Promise.resolve();

const hourLabel = (hour: number) =>
  hour === 0
    ? "12 AM"
    : hour === 12
      ? "12 PM"
      : hour < 12
        ? `${hour}`
        : `${hour - 12}`;

/** Points from the top of the day to `at`. */
const offsetOf = (dayStart: number, at: number) =>
  ((at - dayStart) / 3_600_000) * HOUR;

export default function ScheduleScreen() {
  const ready = useReady();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [width, setWidth] = useState(0);
  const [allDayOpen, setAllDayOpen] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const listHeight = useRef(0);
  const pendingScroll = useRef<number | undefined>(undefined);

  const pickDay = (next: Date) => {
    setDay(next);
    setAllDayOpen(false);
  };

  // All-day events sit above midnight: a row saying how many, and the list
  // itself once pulled down (or the row tapped). Pulling with the list open,
  // or on a day without any, refreshes.
  const allDay =
    ready === undefined ? [] : allDayOn(ready.state.availability, day);
  const allDayLabel = `${allDay.length} all-day event${allDay.length === 1 ? "" : "s"}`;
  const pullOpensList = allDay.length > 0 && !allDayOpen;
  const pull = usePullToRefresh({
    idleLabel: pullOpensList
      ? `Pull to show ${allDayLabel}`
      : "Pull to refresh",
    stages: pullOpensList
      ? [
          {
            at: 56,
            label: `Release to show ${allDayLabel}`,
            run: () => setAllDayOpen(true),
          },
        ]
      : [
          {
            at: 70,
            label: "Release to refresh",
            run: () => (ready?.reload ?? noReload)(),
          },
        ],
    onScrollY: (y) => {
      // Scrolled past the open list: fold it away, and keep the timeline
      // where it was on screen.
      if (!allDayOpen || pendingScroll.current !== undefined) return;
      if (y > SUMMARY_HEIGHT + listHeight.current) {
        pendingScroll.current = y - listHeight.current;
        setAllDayOpen(false);
      }
    },
  });
  useLayoutEffect(() => {
    if (allDayOpen || pendingScroll.current === undefined) return;
    scroller.current?.scrollTo({ y: pendingScroll.current, animated: false });
    pendingScroll.current = undefined;
  }, [allDayOpen]);

  const loaded = useMemo(() => loadWindow(now), [now]);
  const week = weekOf(day);
  const dayStart = day.getTime();
  const dayEnd = addDays(day, 1).getTime();

  if (ready === undefined) return null;
  const { availability } = ready.state;

  const placed = layoutColumns(itemsBetween(availability, dayStart, dayEnd));
  const rail = segments(
    availability.slots.filter((slot) => {
      const at = Date.parse(slot.startTime);
      return at >= dayStart && at < dayEnd;
    }),
  );
  const columnsWidth = Math.max(0, width - EVENTS_LEFT);
  const canGoBack = addDays(week[0]!, -1) >= loaded.start;
  const canGoForward = addDays(week[6]!, 1) < loaded.end;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 14 }]}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.month}>
              {`${MONTHS.at(day.getMonth())} ${day.getFullYear()}`}
            </Text>
            <Text style={styles.title} accessibilityRole="header">
              Schedule
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New override"
            onPress={() => router.push("/override/new")}
            style={styles.iconButton}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M12 5v14M5 12h14"
                stroke={colors.text}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            disabled={!canGoBack}
            onPress={() => pickDay(addDays(day, -7))}
            style={[styles.chevron, !canGoBack && styles.disabled]}
          >
            <Text style={styles.chevronText}>‹</Text>
          </Pressable>
          <View style={styles.week} accessibilityRole="tablist">
            {week.map((date, index) => {
              const selected = sameDay(date, day);
              const today = sameDay(date, now);
              const inWindow = date >= loaded.start && date < loaded.end;
              return (
                <Pressable
                  key={date.toISOString()}
                  accessibilityRole="tab"
                  accessibilityState={{ selected, disabled: !inWindow }}
                  accessibilityLabel={`${DAY_LETTERS.at(index)} ${date.getDate()}${today ? ", today" : ""}`}
                  disabled={!inWindow}
                  onPress={() => pickDay(date)}
                  style={[
                    styles.dayButton,
                    selected && styles.daySelected,
                    !inWindow && styles.disabled,
                  ]}
                >
                  <Text style={[styles.dayLetter, selected && styles.dayInk]}>
                    {DAY_LETTERS.at(index)}
                  </Text>
                  <Text
                    style={[
                      styles.dayNumber,
                      selected && styles.dayInk,
                      today && !selected && styles.today,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next week"
            disabled={!canGoForward}
            onPress={() => pickDay(addDays(day, 7))}
            style={[styles.chevron, !canGoForward && styles.disabled]}
          >
            <Text style={styles.chevronText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.legend}>
          {STATUSES.filter((status) => status !== "clear").map((status) => (
            <View key={status} style={styles.legendItem}>
              <StatusGlyph status={status} size={10} />
              <Text style={styles.legendText}>{LABELS[status]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.timeline}>
        <Animated.ScrollView
          ref={scroller}
          contentOffset={{
            x: 0,
            y: (allDay.length > 0 ? SUMMARY_HEIGHT : 0) + 7 * HOUR,
          }}
          {...pull.scrollProps}
        >
          {allDay.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: allDayOpen }}
              accessibilityHint={allDayOpen ? "Hides them" : "Shows them"}
              onPress={() => setAllDayOpen((open) => !open)}
              style={styles.allDaySummary}
            >
              <Text style={styles.allDayText}>{allDayLabel}</Text>
              <Text style={styles.allDayChevron}>{allDayOpen ? "▴" : "▾"}</Text>
            </Pressable>
          )}
          {allDayOpen && allDay.length > 0 && (
            <View
              style={styles.allDayList}
              onLayout={(event) => {
                listHeight.current =
                  event.nativeEvent.layout.height + ALL_DAY_GAP;
              }}
            >
              {allDay.map((item, index) => (
                <View key={item.id}>
                  {index > 0 && <RowSeparator />}
                  <ItemRow
                    item={item}
                    showTime={false}
                    onPress={() => router.push(hrefOf(item))}
                  />
                </View>
              ))}
            </View>
          )}
          <View
            style={styles.grid}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          >
            {HOURS.map((hour) => (
              <View
                key={hour}
                style={[styles.hourRow, { top: hour * HOUR }]}
                accessible={false}
              >
                <Text style={styles.hourLabel}>{hourLabel(hour)}</Text>
                <View style={styles.hourLine} />
              </View>
            ))}

            {rail.map((run) => (
              <View
                key={run.start}
                style={[
                  styles.rail,
                  {
                    top: offsetOf(dayStart, run.start),
                    height: offsetOf(run.start, run.end),
                    backgroundColor:
                      run.level === "none"
                        ? colors.separator
                        : statusAccent[toOnAirStatus(run.level)],
                  },
                ]}
              />
            ))}

            {placed.map((item) => {
              const top = offsetOf(dayStart, Math.max(item.start, dayStart));
              const height = Math.max(
                22,
                offsetOf(
                  Math.max(item.start, dayStart),
                  Math.min(item.end, dayEnd),
                ) - 2,
              );
              const slotWidth = columnsWidth / item.columns;
              const color = statusAccent[item.status];
              return (
                <Pressable
                  key={`${item.kind}-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${clock(item.start)} to ${clock(item.end)}, ${item.title}, ${LABELS[item.status]}`}
                  onPress={() => router.push(hrefOf(item))}
                  style={[
                    styles.event,
                    {
                      top,
                      height,
                      left: EVENTS_LEFT + item.column * slotWidth,
                      width: slotWidth - 4,
                      backgroundColor: `${color}2E`,
                      borderColor:
                        item.kind === "block" ? color : "transparent",
                    },
                    item.kind === "block" && styles.eventBlock,
                  ]}
                >
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {height > 36 && (
                    <Text style={styles.eventDetail} numberOfLines={1}>
                      {`${clock(item.start)} – ${clock(item.end)} · ${item.detail}`}
                    </Text>
                  )}
                </Pressable>
              );
            })}

            {sameDay(now, day) && (
              <View
                style={[
                  styles.nowLine,
                  { top: offsetOf(dayStart, now.getTime()) },
                ]}
                accessibilityLabel={`Now, ${clock(now)}`}
              >
                <View style={styles.nowDot} />
              </View>
            )}
          </View>
        </Animated.ScrollView>
        <PullHint pull={pull} top={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: 20, gap: 14 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  titleText: { gap: 2 },
  month: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  title: { fontSize: 34, fontWeight: "700", color: colors.text },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  weekRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  chevron: {
    width: 24,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronText: { fontSize: 24, color: colors.textSecondary },
  week: { flex: 1, flexDirection: "row", gap: 4 },
  dayButton: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  daySelected: { backgroundColor: colors.text },
  disabled: { opacity: 0.35 },
  dayLetter: { fontSize: 11, color: colors.textSecondary },
  dayNumber: { fontSize: 17, fontWeight: "600", color: colors.text },
  dayInk: { color: colors.background },
  today: { color: "#E5484D" },
  legend: { flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontSize: 12, color: colors.textSecondary },
  timeline: { flex: 1, marginTop: 12 },
  grid: { height: 24 * HOUR + 24, marginTop: GRID_TOP, marginHorizontal: 20 },
  allDaySummary: {
    height: SUMMARY_HEIGHT - 8,
    marginVertical: 4,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  allDayText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  allDayChevron: { fontSize: 13, color: colors.textSecondary },
  allDayList: {
    marginHorizontal: 20,
    marginBottom: ALL_DAY_GAP,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  hourRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -7,
  },
  hourLabel: {
    width: 36,
    fontSize: 11,
    textAlign: "right",
    color: colors.textTertiary,
  },
  hourLine: { flex: 1, height: 1, backgroundColor: "#222429" },
  rail: {
    position: "absolute",
    left: RAIL_LEFT,
    width: 6,
    borderRadius: 3,
  },
  event: {
    position: "absolute",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 2,
    borderWidth: 1.5,
  },
  eventBlock: { borderStyle: "dashed" },
  eventTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
  eventDetail: { fontSize: 12, color: "#C9CBCF" },
  nowLine: {
    position: "absolute",
    left: RAIL_LEFT - 6,
    right: 0,
    height: 2,
    backgroundColor: "#FFFFFF",
  },
  nowDot: {
    position: "absolute",
    left: -4,
    top: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
});
