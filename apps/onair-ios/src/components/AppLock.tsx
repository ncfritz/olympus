import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../auth/SessionProvider";
import { useLock } from "../lock/LockProvider";
import { waitText } from "../lockRules";
import { colors } from "../theme";
import { useNow } from "../useNow";
import { LoadingScreen } from "./LoadingScreen";
import { PasscodePad } from "./PasscodePad";

/**
 * The lock over everything while OnAir is locked: its own passcode, with
 * Face ID or Touch ID asked first when they are on. After five failed scans
 * (or iOS stopping Face ID) only the passcode opens it.
 */
export function AppLock() {
  const { state } = useSession();
  const lock = useLock();
  const insets = useSafeAreaInsets();
  const now = useNow(15_000);
  const [message, setMessage] = useState<string>();
  const asked = useRef(false);
  const prompting = useRef(false);

  const signedIn = state.phase === "ready" || state.phase === "unreachable";
  const showing = signedIn && (lock.hasPasscode === undefined || lock.locked);

  const askBiometry = useCallback(async () => {
    if (!lock.canScan || prompting.current) return;
    prompting.current = true;
    try {
      const result = await lock.tryBiometry("Unlock OnAir");
      if (result === "ok") setMessage(undefined);
      if (result === "again") setMessage(`${lock.biometry} did not match.`);
      if (result === "passcode") setMessage(undefined);
    } finally {
      prompting.current = false;
    }
  }, [lock]);

  // Ask once each time the lock comes up with the app in front.
  const latest = useRef({ locked: lock.locked, askBiometry });
  useEffect(() => {
    latest.current = { locked: lock.locked, askBiometry };
    if (!lock.locked) asked.current = false;
  });
  useEffect(() => {
    if (lock.locked && !asked.current && AppState.currentState === "active") {
      asked.current = true;
      void askBiometry();
    }
  }, [lock.locked, askBiometry]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && latest.current.locked && !asked.current) {
        asked.current = true;
        void latest.current.askBiometry();
      }
    });
    return () => subscription.remove();
  }, []);

  if (!showing) return null;
  if (lock.hasPasscode === undefined) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <LoadingScreen />
      </View>
    );
  }

  const waiting = lock.record.waitUntil > now.getTime();
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.screen,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.brand}>
        <Text style={styles.brandName}>ONAIR</Text>
        <Text style={styles.brandSub}>Locked</Text>
      </View>
      <PasscodePad
        title="Enter OnAir Passcode"
        message={
          waiting ? waitText(lock.record.waitUntil - now.getTime()) : message
        }
        disabled={waiting}
        onComplete={async (code) => {
          const result = await lock.checkPasscode(code);
          setMessage(result.ok ? undefined : result.message);
        }}
        extra={
          lock.canScan && lock.biometry !== undefined
            ? { label: lock.biometry, onPress: () => void askBiometry() }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { alignItems: "center", gap: 4 },
  brandName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2.3,
    color: "#E5484D",
  },
  brandSub: { fontSize: 13, color: colors.textTertiary },
});
