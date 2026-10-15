import { StyleSheet, Text, View } from "react-native";

import { useSession } from "../auth/SessionProvider";
import { LoadingScreen } from "../components/LoadingScreen";
import { PillButton } from "../components/PillButton";

/** Signed out: the loading screen's sign, with the way in. */
export default function SignInScreen() {
  const { state, signIn } = useSession();
  const signingIn = state.phase === "signed-out" && state.signingIn;
  const problem = state.phase === "signed-out" ? state.problem : undefined;

  return (
    <LoadingScreen message="Sign in to see your status">
      <View style={styles.actions}>
        {problem !== undefined && (
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
        )}
        <PillButton
          label="Sign in with Google"
          primary
          busy={signingIn}
          onPress={() => void signIn()}
        />
      </View>
    </LoadingScreen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
  problem: { fontSize: 14, lineHeight: 19, color: "#FF8A8E" },
});
