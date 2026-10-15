import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useSession } from "../../auth/SessionProvider";
import { Placeholder } from "../../components/Placeholder";
import { PillButton } from "../../components/PillButton";
import { LABELS, toOnAirStatus } from "../../status";
import { colors, statusFill } from "../../theme";
import { levelAt } from "../../time";

export default function NowScreen() {
  const { state, reload, signOut } = useSession();
  if (state.phase !== "ready") return null;

  // Phase 1's proof that sign-in, the token and the API all work: the level
  // of the slot we are in. The designed Now screen replaces this in phase 2.
  const status = toOnAirStatus(
    levelAt(state.availability.slots, new Date()) ?? "none",
  );

  return (
    <Placeholder
      title="Now"
      description="The countdown ring, today's strip and what's up next arrive in phase 2."
    >
      <View
        style={[styles.status, { backgroundColor: statusFill[status] }]}
        accessibilityLabel={`Right now: ${LABELS[status]}`}
      >
        <Text style={styles.statusLabel}>Right now</Text>
        <Text style={styles.statusValue}>{LABELS[status]}</Text>
        <Text style={styles.statusMeta}>
          {state.availability.meetings.length} meetings,{" "}
          {state.availability.blocks.length} overrides today · loaded{" "}
          {state.loadedAt.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <View style={styles.row}>
        <PillButton label="Refresh" primary onPress={() => void reload()} />
        <PillButton label="Sign out" onPress={() => void signOut()} />
      </View>
      <Link href="/meeting/example" style={styles.link}>
        Meeting status
      </Link>
      <Link href="/override/new" style={styles.link}>
        New override
      </Link>
      {__DEV__ && (
        <Link href="/loading" style={styles.link}>
          Preview the loading screen
        </Link>
      )}
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  status: { borderRadius: 20, padding: 20, gap: 6 },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
  },
  statusValue: { fontSize: 30, fontWeight: "700", color: "#FFFFFF" },
  statusMeta: { fontSize: 13, color: "rgba(255,255,255,0.85)" },
  row: { flexDirection: "row", gap: 10 },
  link: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    paddingVertical: 12,
  },
});
