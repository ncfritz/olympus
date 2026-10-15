import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "../theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="meeting/[meetingId]"
          options={{
            headerShown: true,
            title: "Meeting",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <Stack.Screen name="override/new" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="loading"
          options={{ presentation: "fullScreenModal" }}
        />
      </Stack>
    </>
  );
}
