import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";

import { unlock, type UnlockMethod, unlockMethod } from "../appLock";
import { useSession } from "../auth/SessionProvider";
import { LoadingScreen } from "./LoadingScreen";
import { PillButton } from "./PillButton";

/**
 * With Require Face ID on (Settings), the sign screen over everything until
 * the user unlocks: on opening, and again each time OnAir comes back from
 * the background. It locks on going to the background, so the app switcher
 * shows the lock rather than the calendar.
 */
export function AppLock() {
  const { state, settings } = useSession();
  const signedIn = state.phase === "ready" || state.phase === "unreachable";
  const [method, setMethod] = useState<UnlockMethod>();
  const [unlocked, setUnlocked] = useState(false);
  const [problem, setProblem] = useState<string>();
  const prompting = useRef(false);

  useEffect(() => {
    void unlockMethod().then(setMethod);
  }, []);

  // A passcode taken off the iPhone since leaves nothing to unlock with.
  const required =
    signedIn && settings.requireUnlock && method?.available !== false;
  const locked = required && !unlocked;

  // Turned on in Settings, which has just asked: no second prompt now.
  const wasRequired = useRef(settings.requireUnlock);
  useEffect(() => {
    if (signedIn && settings.requireUnlock && !wasRequired.current) {
      setUnlocked(true);
    }
    wasRequired.current = settings.requireUnlock;
  }, [settings.requireUnlock, signedIn]);

  const tryUnlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setProblem(undefined);
    try {
      const result = await unlock("Unlock OnAir");
      if (result.ok) setUnlocked(true);
      else if (result.problem !== undefined) setProblem(result.problem);
    } finally {
      prompting.current = false;
    }
  }, []);

  const lockedRef = useRef(locked);
  useEffect(() => {
    lockedRef.current = locked;
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") setUnlocked(false);
      if (next === "active" && lockedRef.current) void tryUnlock();
    });
    return () => subscription.remove();
  }, [tryUnlock]);

  // Ask as soon as the lock shows in the foreground.
  useEffect(() => {
    if (locked && AppState.currentState === "active") void tryUnlock();
  }, [locked, tryUnlock]);

  if (!locked) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LoadingScreen message="OnAir is locked">
        <View style={styles.actions}>
          {problem !== undefined && (
            <Text style={styles.problem} accessibilityRole="alert">
              {problem}
            </Text>
          )}
          <PillButton
            label={`Unlock with ${method?.name ?? "Face ID"}`}
            onPress={() => void tryUnlock()}
          />
        </View>
      </LoadingScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  problem: { fontSize: 14, color: "#FF8A8E" },
});
