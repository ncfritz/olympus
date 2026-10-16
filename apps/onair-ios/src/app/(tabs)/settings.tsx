import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { scan } from "../../appLock";
import { useReady } from "../../auth/SessionProvider";
import { useLock } from "../../lock/LockProvider";
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
            style={styles.switch}
            value={settings.weekendsFree}
            onValueChange={(weekendsFree) =>
              void updateSettings({ ...settings, weekendsFree })
            }
            accessibilityLabel="Weekends free"
          />
        </View>
      </Section>

      <Section title="CALENDARS">
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/calendars")}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.rowLabel}>Calendars</Text>
          <Text style={styles.rowValue}>
            {settings.hiddenCalendars.length === 0
              ? "›"
              : `${settings.hiddenCalendars.length} hidden  ›`}
          </Text>
        </Pressable>
      </Section>

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
 * OnAir's own passcode (separate from the iPhone's), and Face ID or Touch
 * ID in front of it, which needs the passcode set first.
 */
function SecuritySection() {
  const ready = useReady();
  const lock = useLock();
  const [problem, setProblem] = useState<string>();
  if (ready === undefined) return null;
  const { settings, updateSettings } = ready;
  const name = lock.biometry ?? "Face ID";

  const setBiometrics = async (on: boolean) => {
    setProblem(undefined);
    if (!on) {
      await updateSettings({ ...settings, useBiometrics: false });
      return;
    }
    // A scan now, so it is known to work before it guards the app.
    const result = await scan(`Turn on ${name} for OnAir`);
    if (result === "ok") {
      await updateSettings({ ...settings, useBiometrics: true });
    } else if (result === "failed" || result === "lockout") {
      setProblem(`${name} did not match.`);
    }
  };

  return (
    <Section
      title="SECURITY"
      problem={problem}
      note={
        lock.hasPasscode === true
          ? lock.biometry === undefined
            ? "OnAir asks for its passcode when it opens or comes back."
            : `OnAir asks for ${name} when it opens or comes back, and its passcode after 5 failed tries.`
          : `A passcode of OnAir's own, separate from your iPhone's. Set one to use ${name}.`
      }
    >
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Require Passcode</Text>
        <Switch
          style={styles.switch}
          value={lock.hasPasscode === true}
          disabled={lock.hasPasscode === undefined}
          onValueChange={(on) =>
            router.push({
              pathname: "/passcode",
              params: { mode: on ? "set" : "off" },
            })
          }
          accessibilityLabel="Require passcode"
        />
      </View>
      {lock.hasPasscode === true && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/passcode", params: { mode: "change" } })
          }
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.rowLabel}>Change Passcode</Text>
          <Text style={styles.rowValue}>›</Text>
        </Pressable>
      )}
      {lock.biometry !== undefined && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{`Unlock with ${name}`}</Text>
          <Switch
            style={styles.switch}
            value={lock.hasPasscode === true && settings.useBiometrics}
            disabled={lock.hasPasscode !== true}
            onValueChange={(on) => void setBiometrics(on)}
            accessibilityLabel={`Unlock with ${name}`}
          />
        </View>
      )}
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
  // React Native's iOS Switch sets alignSelf: flex-start on itself, which
  // beats the row's alignItems: center; this puts it back in the middle.
  switch: { alignSelf: "center" },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  rowValue: { flexShrink: 1, fontSize: 15, color: colors.textSecondary },
  actions: { marginTop: 4 },
  note: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  problem: { fontSize: 13, color: "#FF8A8E" },
});
