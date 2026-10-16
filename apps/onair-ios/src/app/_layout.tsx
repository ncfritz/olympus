import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { SessionProvider, useSession } from "../auth/SessionProvider";
import { AppLock } from "../components/AppLock";
import { LoadingScreen } from "../components/LoadingScreen";
import { LockProvider } from "../lock/LockProvider";
import { PillButton } from "../components/PillButton";
import { colors } from "../theme";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <LockProvider>
        <GatedStack />
        <StartupOverlay />
        <AppLock />
      </LockProvider>
    </SessionProvider>
  );
}

/**
 * The app's screens once signed in and loaded; the sign-in screen otherwise
 * (Expo Router's `Stack.Protected`). An unreachable API keeps the person
 * signed in, behind the overlay below.
 */
function GatedStack() {
  const { state } = useSession();
  const ready = state.phase === "ready";
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="meeting/[meetingId]"
          options={{ ...PUSHED, title: "Meeting" }}
        />
        <Stack.Screen
          name="calendars"
          options={{ ...PUSHED, title: "Calendars" }}
        />
        <Stack.Screen name="override/new" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="override/[blockId]"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="passcode" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="loading"
          options={{ presentation: "fullScreenModal" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!ready}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * The loading screen over the navigator while the Keychain is read and today
 * loads, and with a Retry when the API cannot be reached. Over it rather than
 * instead of it, so the navigator is mounted from the first render.
 */
function StartupOverlay() {
  const { state, reload, signOut } = useSession();
  // On screen for a moment at least, so a fast load does not flash it.
  const [shownLongEnough, setShownLongEnough] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShownLongEnough(true), MIN_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);
  if (state.phase === "starting" || !shownLongEnough) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <LoadingScreen />
      </View>
    );
  }
  if (state.phase === "unreachable") {
    return (
      <View style={StyleSheet.absoluteFill}>
        <LoadingScreen message={state.message}>
          <View style={styles.actions}>
            <PillButton
              label="Try again"
              primary
              onPress={() => void reload()}
            />
            <PillButton label="Sign out" onPress={() => void signOut()} />
          </View>
        </LoadingScreen>
      </View>
    );
  }
  return null;
}

/**
 * A screen pushed over the tabs: dark header and a bare chevron back, with
 * no "Back" title and, on iOS 26, no glass capsule around it.
 */
const PUSHED = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  unstable_headerLeftItems: () => [
    {
      type: "button" as const,
      label: "Back",
      icon: { type: "sfSymbol" as const, name: "chevron.left" as const },
      tintColor: colors.text,
      hidesSharedBackground: true,
      onPress: () => router.back(),
    },
  ],
};

/** The loading screen's least time on screen at launch. */
const MIN_LOADING_MS = 600;

const styles = StyleSheet.create({
  actions: { gap: 10 },
});
