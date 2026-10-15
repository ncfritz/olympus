import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useReady } from "../../auth/SessionProvider";
import { OverrideForm } from "../../components/OverrideForm";
import { colors } from "../../theme";

export default function EditOverrideScreen() {
  const { blockId } = useLocalSearchParams<{ blockId: string }>();
  const ready = useReady();
  const block = ready?.state.availability.blocks.find(
    (candidate) => candidate.id === blockId,
  );
  if (ready === undefined) return null;
  if (block === undefined) {
    return (
      <View style={styles.screen}>
        <Text style={styles.missing}>
          This override has been deleted, or is older than a week.
        </Text>
      </View>
    );
  }
  // Keyed by the block, so a reload that changes it starts the form afresh.
  return (
    <OverrideForm key={`${block.id}-${block.lastUpdatedTime}`} block={block} />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  missing: { padding: 20, fontSize: 16, color: colors.textSecondary },
});
