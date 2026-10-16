/*
 * The app passcode's rules: OnAir's own six digits, separate from the
 * iPhone's. Pure, so they are unit-tested; the Keychain side is
 * passcodeStore.ts and the screens are AppLock and the passcode route.
 */

export const PASSCODE_LENGTH = 6;

/**
 * Failed Face ID or Touch ID tries before the passcode is needed: five, as
 * the iPhone allows before it asks for its own passcode.
 */
export const MAX_BIOMETRIC_FAILURES = 5;

export const validPasscode = (code: string): boolean =>
  new RegExp(`^\\d{${PASSCODE_LENGTH}}$`).test(code);

/** The wait after `failures` wrong passcodes in a row, as the iPhone's. */
export const waitAfter = (failures: number): number => {
  const minute = 60_000;
  if (failures < 6) return 0;
  if (failures === 6) return minute;
  if (failures === 7) return 5 * minute;
  if (failures === 8) return 15 * minute;
  return 60 * minute;
};

/** Kept between launches, so quitting does not reset the count. */
export type LockRecord = {
  /** Wrong passcodes in a row. */
  failures: number;
  /** No passcode is checked before this time (epoch ms). */
  waitUntil: number;
  /** Failed Face ID or Touch ID tries since the last unlock. */
  biometricFailures: number;
};

export const CLEAR_RECORD: LockRecord = {
  failures: 0,
  waitUntil: 0,
  biometricFailures: 0,
};

const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

export const parseRecord = (stored: string | null): LockRecord => {
  if (stored === null) return CLEAR_RECORD;
  try {
    const value = JSON.parse(stored) as Partial<LockRecord>;
    return {
      failures: count(value.failures),
      waitUntil: count(value.waitUntil),
      biometricFailures: count(value.biometricFailures),
    };
  } catch {
    return CLEAR_RECORD;
  }
};

export const afterWrongPasscode = (
  record: LockRecord,
  now: number,
): LockRecord => {
  const failures = record.failures + 1;
  const wait = waitAfter(failures);
  return { ...record, failures, waitUntil: wait > 0 ? now + wait : 0 };
};

/** A failed scan; `lockout` when iOS itself has stopped Face ID. */
export const afterBiometricFailure = (
  record: LockRecord,
  lockout: boolean,
): LockRecord => ({
  ...record,
  biometricFailures: lockout
    ? MAX_BIOMETRIC_FAILURES
    : record.biometricFailures + 1,
});

export const biometricsAllowed = (record: LockRecord): boolean =>
  record.biometricFailures < MAX_BIOMETRIC_FAILURES;

/** "Try again in 5 minutes": the wait left, rounded up to the minute. */
export const waitText = (remainingMs: number): string => {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `Try again in ${minutes} minute${minutes === 1 ? "" : "s"}`;
};
