import { Link } from "expo-router";
import { StyleSheet } from "react-native";

import { Placeholder } from "../../components/Placeholder";
import { colors } from "../../theme";

export default function NowScreen() {
  return (
    <Placeholder
      title="Now"
      description="Your current status, the countdown ring, today's strip and what's up next. Built in phase 2."
    >
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
  link: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    paddingVertical: 12,
  },
});
