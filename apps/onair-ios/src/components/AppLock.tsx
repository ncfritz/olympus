import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../auth/SessionProvider";
import { useLock } from "../lock/LockProvider";
import { waitText } from "../lockRules";
import { useNow } from "../useNow";
import { LoadingScreen } from "./LoadingScreen";
import { PasscodePad } from "./PasscodePad";

/**
 * The lock over everything while OnAir is locked: the ON AIR sign, with
 * Face ID or Touch ID asked first when they are on and the passcode pad
 * only once that has not worked (failed, cancelled, or Enter Passcode).
 * After five failed scans (or iOS stopping Face ID) only the passcode
 * opens it, and the pad shows straight away.
 */
export function AppLock() {
  const { state } = useSession();
  const lock = useLock();
  const signedIn = state.phase === "ready" || state.phase === "unreachable";
  if (!signedIn || (lock.hasPasscode !== undefined && !lock.locked)) {
    return null;
  }
  if (lock.hasPasscode === undefined) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <LoadingScreen />
      </View>
    );
  }
  // Mounted afresh for each lock, so Face ID gets its go each time.
  return <LockScreen />;
}

function LockScreen() {
  const lock = useLock();
  const insets = useSafeAreaInsets();
  const now = useNow(15_000);
  const [message, setMessage] = useState<string>();
  // Face ID has had its go for this lock: the pad may show.
  const [scanned, setScanned] = useState(false);
  const prompting = useRef(false);
  const asked = useRef(false);

  const askBiometry = useCallback(async () => {
    if (!lock.canScan || prompting.current) return;
    prompting.current = true;
    try {
      const result = await lock.tryBiometry("Unlock OnAir");
      if (result === "ok") return;
      setScanned(true);
      setMessage(
        result === "again" ? `${lock.biometry} did not match.` : undefined,
      );
    } finally {
      prompting.current = false;
    }
  }, [lock]);

  // Ask as the lock comes up in front, or when the app comes back to it.
  const ask = useRef(askBiometry);
  useEffect(() => {
    ask.current = askBiometry;
  });
  useEffect(() => {
    const askOnce = () => {
      if (asked.current) return;
      asked.current = true;
      void ask.current();
    };
    if (AppState.currentState === "active") askOnce();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") askOnce();
    });
    return () => subscription.remove();
  }, []);

  const waiting = lock.record.waitUntil > now.getTime();
  const showPad = !lock.canScan || scanned;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LoadingScreen bare />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        {showPad && (
          <PasscodePad
            title="Enter OnAir Passcode"
            message={
              waiting
                ? waitText(lock.record.waitUntil - now.getTime())
                : message
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
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: "center", justifyContent: "flex-end" },
});
