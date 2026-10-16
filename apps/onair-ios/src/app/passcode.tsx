import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useSession } from "../auth/SessionProvider";
import { PasscodePad } from "../components/PasscodePad";
import { useLock } from "../lock/LockProvider";
import { colors } from "../theme";

type Mode = "set" | "change" | "off";
type Step = "current" | "new" | "confirm";

const TITLES: Record<Step, string> = {
  current: "Enter Your Passcode",
  new: "Enter a New Passcode",
  confirm: "Enter It Again",
};

/**
 * Setting, changing or turning off OnAir's passcode, from Settings. The
 * current one first for a change or turning it off; a new one twice.
 */
export default function PasscodeScreen() {
  const { mode: raw } = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = raw === "change" || raw === "off" ? raw : "set";
  const lock = useLock();
  const { settings, updateSettings } = useSession();
  const [step, setStep] = useState<Step>(mode === "set" ? "new" : "current");
  const [first, setFirst] = useState("");
  const [message, setMessage] = useState<string>();

  const complete = async (code: string) => {
    if (step === "current") {
      const result = await lock.checkPasscode(code);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(undefined);
      if (mode === "off") {
        await lock.removePasscode();
        if (settings.useBiometrics) {
          await updateSettings({ ...settings, useBiometrics: false });
        }
        router.back();
        return;
      }
      setStep("new");
      return;
    }
    if (step === "new") {
      setFirst(code);
      setMessage(undefined);
      setStep("confirm");
      return;
    }
    if (code !== first) {
      setFirst("");
      setMessage("Passcodes did not match. Try again.");
      setStep("new");
      return;
    }
    await lock.setPasscode(code);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.cancel}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === "off"
            ? "Turn Off Passcode"
            : mode === "change"
              ? "Change Passcode"
              : "Set Passcode"}
        </Text>
        <View style={styles.cancel} />
      </View>
      <View style={styles.body}>
        <PasscodePad
          key={step}
          title={TITLES[step]}
          message={message}
          onComplete={complete}
        />
        {step !== "current" && (
          <Text style={styles.note}>
            Six digits, separate from your iPhone passcode.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  cancel: { width: 64, height: 44, justifyContent: "center" },
  cancelText: { fontSize: 17, color: "#C9CBCF" },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  note: { fontSize: 13, color: colors.textSecondary },
});
