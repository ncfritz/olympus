import * as LocalAuthentication from "expo-local-authentication";

/*
 * Face ID or Touch ID, as a quicker way past OnAir's own passcode. The
 * iPhone's passcode is never offered: the fallback is OnAir's passcode.
 */

export type Biometry = "Face ID" | "Touch ID";

/** What this iPhone has set up, if either. */
export const biometry = async (): Promise<Biometry | undefined> => {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (
    level !== LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK &&
    level !== LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
  ) {
    return undefined;
  }
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    return "Face ID";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Touch ID";
  }
  return undefined;
};

/**
 * One Face ID or Touch ID prompt. `fallback`: the user chose the passcode;
 * `failed`: the scans did not match; `lockout`: iOS has stopped biometrics
 * after too many tries, so only a passcode will do.
 */
export type ScanResult = "ok" | "fallback" | "cancel" | "failed" | "lockout";

export const scan = async (reason: string): Promise<ScanResult> => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Cancel",
    fallbackLabel: "Enter Passcode",
    disableDeviceFallback: true,
  });
  if (result.success) return "ok";
  switch (result.error) {
    case "user_fallback":
      return "fallback";
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
      return "cancel";
    case "lockout":
      return "lockout";
    case "authentication_failed":
      return "failed";
    default:
      return "fallback";
  }
};
