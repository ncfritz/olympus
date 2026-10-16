import * as LocalAuthentication from "expo-local-authentication";

/*
 * Unlocking with Face ID or Touch ID, falling back to the iPhone's passcode
 * (iOS offers it after a failed scan, or straight away without biometrics).
 */

export type UnlockMethod = {
  /** The iPhone has a passcode, so OnAir can be locked at all. */
  available: boolean;
  /** What the buttons and Settings call it. */
  name: "Face ID" | "Touch ID" | "Passcode";
};

export const unlockMethod = async (): Promise<UnlockMethod> => {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return { available: false, name: "Passcode" };
  }
  if (level === LocalAuthentication.SecurityLevel.SECRET) {
    return { available: true, name: "Passcode" };
  }
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    return { available: true, name: "Face ID" };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { available: true, name: "Touch ID" };
  }
  return { available: true, name: "Passcode" };
};

/** Asks for Face ID, Touch ID or the passcode. A cancel is not a problem. */
export const unlock = async (
  reason: string,
): Promise<{ ok: true } | { ok: false; problem?: string }> => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Cancel",
    fallbackLabel: "Use Passcode",
    disableDeviceFallback: false,
  });
  if (result.success) return { ok: true };
  switch (result.error) {
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
      return { ok: false };
    case "lockout":
      return { ok: false, problem: "Too many tries. Use your passcode." };
    case "passcode_not_set":
      return { ok: false, problem: "This iPhone has no passcode set." };
    default:
      return { ok: false, problem: "Could not unlock. Try again." };
  }
};
