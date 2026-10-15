import { router } from "expo-router";
import { Pressable } from "react-native";

import { LoadingScreen } from "../components/LoadingScreen";

/**
 * A development preview of the loading screen; tap to close. Once sign-in
 * exists (phase 1), the root layout shows `LoadingScreen` while the session
 * and the first availability load, and this route goes away.
 */
export default function LoadingPreview() {
  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={() => router.back()}
      accessibilityHint="Closes the preview"
    >
      <LoadingScreen />
    </Pressable>
  );
}
