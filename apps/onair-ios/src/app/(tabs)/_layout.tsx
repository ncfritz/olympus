import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { AddTabButton } from "../../components/AddTabButton";
import { TabIcon, type TabIconName } from "../../components/TabIcon";
import { colors } from "../../theme";

const icon =
  (name: TabIconName) =>
  ({ color }: { color: ColorValue }) => <TabIcon name={name} color={color} />;

/*
 * Expo Router's JavaScript tabs, styled to the design. SDK 57 has native tabs
 * only as `expo-router/unstable-native-tabs`; revisit at SDK 58, where they are
 * `expo-router/native-tabs`. The centre slot is New override, not a tab.
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Now", tabBarIcon: icon("now") }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: "Schedule", tabBarIcon: icon("schedule") }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "New override",
          tabBarButton: () => <AddTabButton />,
        }}
        listeners={{ tabPress: (event) => event.preventDefault() }}
      />
      <Tabs.Screen
        name="overrides"
        options={{ title: "Overrides", tabBarIcon: icon("overrides") }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: icon("settings") }}
      />
    </Tabs>
  );
}
