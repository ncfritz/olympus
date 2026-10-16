import DateTimePicker from "@react-native-community/datetimepicker";
import type { AvailabilityBlock } from "@ncfritz/olympus-sdk/minerva";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useReady } from "../auth/SessionProvider";
import {
  clockWithPeriod,
  covered,
  type LengthChoice,
  lengthChoices,
} from "../schedule";
import {
  LABELS,
  type OnAirStatus,
  STATUSES,
  toLevel,
  toOnAirStatus,
} from "../status";
import { colors, statusAccent, statusFill } from "../theme";
import { PillButton } from "./PillButton";
import { StatusGlyph } from "./StatusGlyph";

/** What the light does for a status, for the summary line. */
const LIGHT: Record<OnAirStatus, string> = {
  dnd: "goes red",
  interrupt: "goes yellow",
  free: "goes green",
  clear: "is off",
};

/**
 * New override, and editing one: a status, when it runs, and a label. New
 * starts now with the length chips; editing starts from the block and adds
 * Delete. Both save through the session, which reloads every screen.
 */
export function OverrideForm({ block }: { block?: AvailabilityBlock }) {
  const ready = useReady();
  const [opened] = useState(() => new Date());
  const [status, setStatus] = useState<OnAirStatus>(
    block === undefined ? "dnd" : toOnAirStatus(block.status),
  );
  const [start, setStart] = useState(() =>
    block === undefined ? opened : new Date(block.startTime),
  );
  const [end, setEnd] = useState(() =>
    block === undefined
      ? new Date(opened.getTime() + 60 * 60_000)
      : new Date(block.endTime),
  );
  const [length, setLength] = useState<LengthChoice["key"] | undefined>(
    block === undefined ? "1h" : undefined,
  );
  const [label, setLabel] = useState(block?.label ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  if (ready === undefined) return null;
  const { availability } = ready.state;
  const choices =
    block === undefined
      ? lengthChoices(availability, opened, ready.settings)
      : [];
  const meetings = covered(availability, start.getTime(), end.getTime());
  const valid = end.getTime() > start.getTime();

  const run = async (kind: "save" | "delete", action: () => Promise<void>) => {
    setBusy(kind);
    setProblem(undefined);
    try {
      await action();
      router.back();
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(undefined);
    }
  };

  const save = () =>
    run("save", () => {
      const fields = {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: toLevel(status),
      };
      const trimmed = label.trim();
      return block === undefined
        ? ready.saveBlock({
            ...fields,
            ...(trimmed === "" ? {} : { label: trimmed }),
          })
        : ready.saveBlock({
            id: block.id,
            ...fields,
            label: trimmed === "" ? null : trimmed,
          });
    });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {block === undefined ? "New override" : "Override"}
        </Text>
        <View style={styles.cancel} />
      </View>

      <Text style={styles.section}>SHOW ME AS</Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {STATUSES.map((option) => {
          const selected = option === status;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={LABELS[option]}
              onPress={() => setStatus(option)}
              style={[
                styles.tile,
                selected && { backgroundColor: statusFill[option] },
              ]}
            >
              <StatusGlyph
                status={option}
                size={18}
                color={selected ? "#FFFFFF" : statusAccent[option]}
              />
              <Text style={styles.tileText}>{LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>

      {choices.length > 0 && (
        <>
          <Text style={styles.section}>FOR</Text>
          <View style={styles.chips}>
            {choices.map((choice) => {
              const selected = choice.key === length;
              return (
                <Pressable
                  key={choice.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setLength(choice.key);
                    setStart(opened);
                    setEnd(new Date(choice.end));
                  }}
                  style={[styles.chip, selected && styles.chipOn]}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextOn]}
                  >
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Starts</Text>
          <DateTimePicker
            value={start}
            mode="datetime"
            display="compact"
            themeVariant="dark"
            minuteInterval={5}
            onValueChange={(_event, date) => {
              if (date === undefined) return;
              setLength(undefined);
              setStart(date);
            }}
          />
        </View>
        <View style={styles.rule} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Ends</Text>
          <DateTimePicker
            value={end}
            mode="datetime"
            display="compact"
            themeVariant="dark"
            minuteInterval={5}
            minimumDate={start}
            onValueChange={(_event, date) => {
              if (date === undefined) return;
              setLength(undefined);
              setEnd(date);
            }}
          />
        </View>
        <View style={styles.rule} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Label</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Optional"
            placeholderTextColor={colors.textTertiary}
            maxLength={200}
            style={styles.input}
            accessibilityLabel="Label"
          />
        </View>
      </View>

      <Text style={styles.summary}>
        {meetings.length === 0
          ? "Covers no meetings. "
          : `Covers ${meetings.map((m) => m.subject ?? "a meeting").join(", ")}. `}
        {valid
          ? `Your light ${LIGHT[status]} until ${clockWithPeriod(end)}.`
          : "The end has to be after the start."}
      </Text>

      {problem !== undefined && (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      )}

      <View style={styles.actions}>
        <PillButton
          label={block === undefined ? "Set override" : "Update Override"}
          primary={block === undefined}
          busy={busy === "save"}
          onPress={() => {
            if (valid) void save();
          }}
        />
        {block !== undefined && (
          <PillButton
            label="Delete override"
            danger
            busy={busy === "delete"}
            onPress={() =>
              void run("delete", () => ready.deleteBlock(block.id))
            }
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancel: { width: 64, height: 44, justifyContent: "center" },
  cancelText: { fontSize: 17, color: "#C9CBCF" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  section: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: colors.textSecondary,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    flexGrow: 1,
    height: 84,
    borderRadius: 18,
    padding: 14,
    justifyContent: "space-between",
    backgroundColor: "#26282C",
  },
  tileText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#26282C",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.text },
  chipText: { fontSize: 15, fontWeight: "600", color: colors.text },
  chipTextOn: { color: colors.background },
  card: { marginTop: 8, backgroundColor: "#1F2125", borderRadius: 18 },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    gap: 12,
  },
  rowLabel: { fontSize: 16, color: colors.textSecondary },
  rule: { height: 1, backgroundColor: "#2E3035", marginLeft: 16 },
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
    textAlign: "right",
    color: colors.text,
  },
  summary: { fontSize: 14, lineHeight: 20, color: "#C9CBCF" },
  problem: { fontSize: 14, color: "#FF8A8E" },
  actions: { gap: 10, marginTop: 6 },
});
