import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
import type { Calendar } from "@ncfritz/olympus-sdk/minerva";
import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { unlock, type UnlockMethod, unlockMethod } from "../../appLock";
import { useReady } from "../../auth/SessionProvider";
import { PillButton } from "../../components/PillButton";
import { API_BASE_URLS, apiBaseUrl } from "../../config";
import { clockWithPeriod, dayTitle } from "../../schedule";
import { longTime, minutesOf, timeToday, validHours } from "../../settings";
import { colors } from "../../theme";

const apiBase = apiBaseUrl(process.env.EXPO_PUBLIC_OLYMPUS_API_BASE_URL);
/** The host alone: RN's URL has no `host`, so by hand. */
const apiHost = apiBase.replace(/^https?:\/\//, "").split("/")[0] ?? apiBase;
const connection =
  apiBase === API_BASE_URLS.internal
    ? "Home network only"
    : apiBase === API_BASE_URLS.production
      ? "Through the border"
      : "Development";

/**
 * Settings: the working day (hours and weekends), where the app talks to,
 * how fresh the data is, and sign out.
 */
export default function SettingsScreen() {
  const ready = useReady();
  const insets = useSafeAreaInsets();
  // The pickers' values, which may be a moment out of order while being set.
  const [draft, setDraft] = useState<{ start: number; end: number }>();
  if (ready === undefined) return null;
  const { state, signOut, settings, updateSettings } = ready;
  const start = draft?.start ?? settings.dayStart;
  const end = draft?.end ?? settings.dayEnd;
  const hoursValid = validHours(start, end);

  const setHours = (nextStart: number, nextEnd: number) => {
    if (validHours(nextStart, nextEnd)) {
      setDraft(undefined);
      void updateSettings({
        ...settings,
        dayStart: nextStart,
        dayEnd: nextEnd,
      });
    } else {
      setDraft({ start: nextStart, end: nextEnd });
    }
  };
  const version = Constants.expoConfig?.version ?? "—";
  const build = Constants.expoConfig?.ios?.buildNumber;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
    >
      <Text style={styles.title} accessibilityRole="header">
        Settings
      </Text>

      <Section
        title="WORKING HOURS"
        note={
          hoursValid
            ? `Outside ${longTime(start)} to ${longTime(end)}${settings.weekendsFree ? " and at weekends" : ""} you show as clear, unless an override or a meeting you set says otherwise.`
            : undefined
        }
        problem={hoursValid ? undefined : "The end has to be after the start."}
      >
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Starts</Text>
          <DateTimePicker
            value={timeToday(start)}
            mode="time"
            display="compact"
            themeVariant="dark"
            minuteInterval={15}
            onValueChange={(_event, date) => {
              if (date !== undefined) setHours(minutesOf(date), end);
            }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Ends</Text>
          <DateTimePicker
            value={timeToday(end)}
            mode="time"
            display="compact"
            themeVariant="dark"
            minuteInterval={15}
            onValueChange={(_event, date) => {
              if (date !== undefined) setHours(start, minutesOf(date));
            }}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Weekends free</Text>
          <Switch
            value={settings.weekendsFree}
            onValueChange={(weekendsFree) =>
              void updateSettings({ ...settings, weekendsFree })
            }
            accessibilityLabel="Weekends free"
          />
        </View>
      </Section>

      <CalendarsSection />

      <SecuritySection />

      <Section title="SERVER">
        <Row label="API" value={apiHost} />
        <Row label="Connection" value={connection} />
      </Section>

      <Section title="DATA">
        <Row
          label="Last updated"
          value={`${dayTitle(state.loadedAt, new Date())}, ${clockWithPeriod(state.loadedAt)}`}
        />
        <Row label="Refreshes" value="Every 30 seconds and on open" />
      </Section>

      <Section title="ABOUT">
        <Row
          label="Version"
          value={build === undefined ? version : `${version} (${build})`}
        />
      </Section>

      <View style={styles.actions}>
        <PillButton label="Sign out" onPress={() => void signOut()} />
      </View>
    </ScrollView>
  );
}

/**
 * Each synced calendar, with two switches: Counts toward busy (the
 * calendar's own setting on the server, which the site and the lamp follow
 * too) and Show in app (this phone only).
 */
function CalendarsSection() {
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

  return (
    <Section
      title="CALENDARS"
      problem={problem}
      note="Counts toward busy changes your status everywhere, on the site and the lamp too. Show in app only hides a calendar's events on this phone."
    >
      {calendars === undefined ? (
        <View style={styles.row}>
          {problem === undefined ? (
            <ActivityIndicator color={colors.textSecondary} />
          ) : (
            <Text style={styles.rowValue}>Could not load the calendars.</Text>
          )}
        </View>
      ) : calendars.length === 0 ? (
        <View style={styles.row}>
          <Text style={styles.rowValue}>No calendars are synced yet.</Text>
        </View>
      ) : (
        calendars.map((calendar) => (
          <View key={calendar.calendarId} style={styles.calendar}>
            <View style={styles.calendarHead}>
              <View
                style={[
                  styles.calendarDot,
                  { backgroundColor: calendar.color ?? colors.textTertiary },
                ]}
              />
              <Text style={styles.calendarName} numberOfLines={1}>
                {calendar.source}
              </Text>
              {!calendar.enabled && (
                <Text style={styles.rowValue}>Not syncing</Text>
              )}
            </View>
            <View style={styles.subRow}>
              <Text style={styles.subLabel}>Counts toward busy</Text>
              <Switch
                value={calendar.includedInBusy}
                onValueChange={(counted) => setCounted(calendar, counted)}
                accessibilityLabel={`${calendar.source} counts toward busy`}
              />
            </View>
            <View style={styles.subRow}>
              <Text style={styles.subLabel}>Show in app</Text>
              <Switch
                value={!settings.hiddenCalendars.includes(calendar.source)}
                onValueChange={(shown) => setShown(calendar.source, shown)}
                accessibilityLabel={`Show ${calendar.source} in the app`}
              />
            </View>
          </View>
        ))
      )}
    </Section>
  );
}

/**
 * Require Face ID (or Touch ID, or the passcode on an iPhone without
 * either). Turning it on or off asks first, so it is the owner changing it.
 */
function SecuritySection() {
  const ready = useReady();
  const [method, setMethod] = useState<UnlockMethod>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    void unlockMethod().then(setMethod);
  }, []);

  if (ready === undefined) return null;
  const { settings, updateSettings } = ready;
  const name = method?.name ?? "Face ID";

  const setRequired = async (requireUnlock: boolean) => {
    setProblem(undefined);
    const result = await unlock(
      requireUnlock
        ? `Turn on ${name} for OnAir`
        : `Turn off ${name} for OnAir`,
    );
    if (result.ok) await updateSettings({ ...settings, requireUnlock });
    else if (result.problem !== undefined) setProblem(result.problem);
  };

  return (
    <Section
      title="SECURITY"
      problem={problem}
      note={
        method?.available === false
          ? "Set a passcode on this iPhone to lock OnAir."
          : name === "Passcode"
            ? "Asks for your iPhone passcode when OnAir opens or comes back."
            : `Asks for ${name} when OnAir opens or comes back. If ${name} fails, your iPhone passcode works.`
      }
    >
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{`Require ${name}`}</Text>
        <Switch
          value={settings.requireUnlock}
          disabled={method?.available !== true}
          onValueChange={(value) => void setRequired(value)}
          accessibilityLabel={`Require ${name}`}
        />
      </View>
    </Section>
  );
}

function Section({
  title,
  note,
  problem,
  children,
}: {
  title: string;
  note?: string | undefined;
  problem?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
      {problem !== undefined && (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      )}
      {note !== undefined && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${label}, ${value}`}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 22 },
  title: { fontSize: 34, fontWeight: "700", color: colors.text },
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
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowLabel: { fontSize: 16, color: colors.text },
  rowValue: { flexShrink: 1, fontSize: 15, color: colors.textSecondary },
  actions: { marginTop: 4 },
  note: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  calendar: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  calendarHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  calendarDot: { width: 10, height: 10, borderRadius: 5 },
  calendarName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  subRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 36,
    paddingRight: 16,
  },
  subLabel: { fontSize: 15, color: colors.textSecondary },
  problem: { fontSize: 13, color: "#FF8A8E" },
});
