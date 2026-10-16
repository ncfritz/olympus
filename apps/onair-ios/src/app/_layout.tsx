import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";

import { SessionProvider, useSession } from "../auth/SessionProvider";
import { LoadingScreen } from "../components/LoadingScreen";
import { PillButton } from "../components/PillButton";
import { colors } from "../theme";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <GatedStack />
      <StartupOverlay />
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
          options={{
            headerShown: true,
            title: "Meeting",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            // A bare chevron: no "Back" title and, on iOS 26, no glass
            // capsule around it.
            unstable_headerLeftItems: () => [
              {
                type: "button",
                label: "Back",
                icon: { type: "sfSymbol", name: "chevron.left" },
                tintColor: colors.text,
                hidesSharedBackground: true,
                onPress: () => router.back(),
              },
            ],
          }}
        />
        <Stack.Screen name="override/new" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="override/[blockId]"
          options={{ presentation: "modal" }}
        />
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
  if (state.phase === "starting") {
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

const styles = StyleSheet.create({
  actions: { gap: 10 },
});
