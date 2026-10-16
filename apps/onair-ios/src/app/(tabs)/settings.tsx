import Constants from "expo-constants";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReady } from "../../auth/SessionProvider";
import { PillButton } from "../../components/PillButton";
import { API_BASE_URLS, apiBaseUrl } from "../../config";
import { clockWithPeriod, dayTitle } from "../../schedule";
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

/** Settings: where the app talks to, how fresh the data is, and sign out. */
export default function SettingsScreen() {
  const ready = useReady();
  const insets = useSafeAreaInsets();
  if (ready === undefined) return null;
  const { state, signOut } = ready;
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
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
});
