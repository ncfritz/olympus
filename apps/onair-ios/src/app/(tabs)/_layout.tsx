import { Tabs } from "expo-router";

import { colors } from "../../theme";

/*
 * Expo Router's JavaScript tabs, styled to the design. SDK 57 has native tabs
 * only as `expo-router/unstable-native-tabs`; revisit at SDK 58, where they are
 * `expo-router/native-tabs`. Icons arrive with the screens in phase 2.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: "#222429",
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Now" }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule" }} />
      <Tabs.Screen name="overrides" options={{ title: "Overrides" }} />
    </Tabs>
  );
}
