import type { Calendar } from "@ncfritz/olympus-sdk/minerva";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { useReady } from "../auth/SessionProvider";
import { colors } from "../theme";

/**
 * Settings › Calendars: two checklists. Count toward busy is each
 * calendar's own setting on the server, which the site and the lamp follow
 * too; Show in OnAir is this iPhone only.
 */
export default function CalendarsScreen() {
  const ready = useReady();
  const [calendars, setCalendars] = useState<Calendar[]>();
  const [problem, setProblem] = useState<string>();
  const listCalendars = ready?.listCalendars;

  useEffect(() => {
    if (listCalendars === undefined) return;
    let cancelled = false;
    listCalendars().then(
      (list) => {
        if (!cancelled) setCalendars(list);
      },
      (error: Error) => {
        if (!cancelled) setProblem(error.message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [listCalendars]);

  if (ready === undefined) return null;
  const { settings, updateSettings, setCalendarCounted } = ready;

  const setCounted = (calendar: Calendar, counted: boolean) => {
    const before = calendars;
    setProblem(undefined);
    setCalendars(
      calendars?.map((c) =>
        c.calendarId === calendar.calendarId
          ? { ...c, includedInBusy: counted }
          : c,
      ),
    );
    setCalendarCounted(calendar.calendarId, counted).catch((error: Error) => {
      setCalendars(before);
      setProblem(error.message);
    });
  };

  const setShown = (source: string, shown: boolean) => {
    const others = settings.hiddenCalendars.filter((s) => s !== source);
    void updateSettings({
      ...settings,
      hiddenCalendars: shown ? others : [...others, source],
    });
  };

  if (calendars === undefined || calendars.length === 0) {
    return (
      <View style={[styles.screen, styles.centred]}>
        {calendars === undefined && problem === undefined ? (
          <ActivityIndicator color={colors.textSecondary} />
        ) : (
          <Text style={styles.note}>
            {problem ?? "No calendars are synced yet."}
          </Text>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {problem !== undefined && (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      )}
      <Checklist
        title="COUNT TOWARD BUSY"
        note="Their meetings set your status everywhere: the site and the lamp too."
        calendars={calendars}
        isOn={(calendar) => calendar.includedInBusy}
        onToggle={(calendar, on) => setCounted(calendar, on)}
      />
      <Checklist
        title="SHOW IN ONAIR"
        note="On this iPhone only. A hidden calendar still counts if it is ticked above."
        calendars={calendars}
        isOn={(calendar) => !settings.hiddenCalendars.includes(calendar.source)}
        onToggle={(calendar, on) => setShown(calendar.source, on)}
      />
    </ScrollView>
  );
}

function Checklist({
  title,
  note,
  calendars,
  isOn,
  onToggle,
}: {
  title: string;
  note: string;
  calendars: Calendar[];
  isOn: (calendar: Calendar) => boolean;
  onToggle: (calendar: Calendar, on: boolean) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {calendars.map((calendar, index) => {
          const on = isOn(calendar);
          return (
            <Pressable
              key={calendar.calendarId}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={calendar.source}
              onPress={() => onToggle(calendar, !on)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rule,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: calendar.color ?? colors.textTertiary },
                ]}
              />
              <Text style={[styles.name, !on && styles.nameOff]}>
                {calendar.source}
              </Text>
              {!calendar.enabled && (
                <Text style={styles.paused}>Not syncing</Text>
              )}
              {on && (
                <Svg
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  accessible={false}
                >
                  <Path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke={colors.text}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              )}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centred: { alignItems: "center", justifyContent: "center", padding: 20 },
  content: { padding: 20, gap: 26, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: {
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
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  nameOff: { color: colors.textSecondary },
  paused: { fontSize: 13, color: colors.textTertiary },
  note: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  problem: { fontSize: 14, color: "#FF8A8E" },
});
