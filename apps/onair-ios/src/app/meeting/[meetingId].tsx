import { router, Stack, useLocalSearchParams } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useReady } from "../../auth/SessionProvider";
import { PillButton } from "../../components/PillButton";
import { StatusGlyph } from "../../components/StatusGlyph";
import { clock, dayTitle, duration } from "../../schedule";
import {
  LABELS,
  levelOfCalendarStatus,
  type OnAirStatus,
  toLevel,
  toOnAirStatus,
} from "../../status";
import { colors, statusAccent } from "../../theme";

type Choice = "follow" | Exclude<OnAirStatus, "clear">;

const CHOICES: Exclude<Choice, "follow">[] = ["dnd", "interrupt", "free"];

export default function MeetingScreen() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const ready = useReady();
  const meeting = ready?.state.availability.meetings.find(
    (candidate) => candidate.meetingId === meetingId,
  );
  const [choice, setChoice] = useState<Choice | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  if (ready === undefined) return null;
  if (meeting === undefined) {
    return (
      <View style={styles.screen}>
        <Text style={styles.missing}>
          This meeting is not in the next two weeks any more.
        </Text>
      </View>
    );
  }

  const start = Date.parse(meeting.startTime);
  const end = Date.parse(meeting.endTime);
  const fromCalendar = toOnAirStatus(
    levelOfCalendarStatus(meeting.calendarStatus),
  );
  const current: Choice = meeting.overridden
    ? (toOnAirStatus(meeting.status) as Choice)
    : "follow";
  const picked = choice ?? current;

  const save = async (level: Choice) => {
    setSaving(true);
    setProblem(undefined);
    try {
      await ready.setMeetingLevel(
        meeting.meetingId,
        level === "follow" ? undefined : toLevel(level),
      );
      router.back();
    } catch (error) {
      setProblem((error as Error).message);
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: "Meeting" }} />
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">
          {meeting.subject ?? "Untitled meeting"}
        </Text>
        <Text style={styles.when}>
          {`${dayTitle(new Date(start), new Date())} · ${clock(start)} – ${clock(end)} · ${duration(end - start)}`}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Calendar says</Text>
          <Text style={styles.factValue}>
            {`${meeting.calendarStatus} → ${LABELS[fromCalendar]}`}
          </Text>
        </View>
        <View style={styles.rule} />
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Counts toward status</Text>
          <Text style={styles.factValue}>{meeting.counted ? "Yes" : "No"}</Text>
        </View>
      </View>

      <Text style={styles.section}>STATUS FOR THIS MEETING</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        <Option
          selected={picked === "follow"}
          onPress={() => setChoice("follow")}
          glyph={<View style={styles.followGlyph} />}
          title="Follow calendar"
          subtitle={`${LABELS[fromCalendar]}, from ${meeting.calendarStatus}`}
        />
        {CHOICES.map((status) => (
          <Option
            key={status}
            selected={picked === status}
            onPress={() => setChoice(status)}
            glyph={<StatusGlyph status={status} size={26} />}
            title={LABELS[status]}
            color={statusAccent[status]}
          />
        ))}
      </View>

      <Text style={styles.note}>
        Applies to this meeting only. An override covering the same time takes
        precedence; overlapping meetings take the highest level.
      </Text>

      {problem !== undefined && (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      )}

      <View style={styles.actions}>
        <PillButton
          label={meeting.overridden ? "Update Status" : "Set Status"}
          busy={saving}
          onPress={() => void save(picked)}
        />
        {meeting.overridden && (
          <PillButton
            label="Remove my setting"
            onPress={() => void save("follow")}
          />
        )}
      </View>
    </ScrollView>
  );
}

function Option({
  selected,
  onPress,
  glyph,
  title,
  subtitle,
  color,
}: {
  selected: boolean;
  onPress: () => void;
  glyph: ReactNode;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      {glyph}
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle !== undefined && (
          <Text style={styles.optionSubtitle}>{subtitle}</Text>
        )}
      </View>
      {selected && (
        <Text style={[styles.check, { color: color ?? colors.text }]}>✓</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  missing: { padding: 20, fontSize: 16, color: colors.textSecondary },
  heading: { gap: 6 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  when: { fontSize: 15, color: colors.textSecondary },
  card: { backgroundColor: colors.surface, borderRadius: 18 },
  fact: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  factLabel: { fontSize: 15, color: colors.textSecondary },
  factValue: { fontSize: 15, color: colors.text },
  rule: { height: 1, backgroundColor: colors.separator, marginLeft: 16 },
  section: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  options: { gap: 10, marginTop: -8 },
  option: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  optionSelected: { backgroundColor: colors.surfaceRaised },
  followGlyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#6B6F76",
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
  optionSubtitle: { fontSize: 13, color: colors.textSecondary },
  check: { fontSize: 18, fontWeight: "700" },
  note: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  problem: { fontSize: 14, color: "#FF8A8E" },
  actions: { gap: 10 },
});
