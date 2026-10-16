import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { type Biometry, biometry as findBiometry, scan } from "../appLock";
import { useSession } from "../auth/SessionProvider";
import {
  afterBiometricFailure,
  afterWrongPasscode,
  biometricsAllowed,
  CLEAR_RECORD,
  type LockRecord,
  waitText,
} from "../lockRules";
import {
  hasPasscode as storedPasscode,
  loadRecord,
  passcodeMatches,
  removePasscode as forgetPasscode,
  saveRecord,
  savePasscode,
} from "../passcodeStore";

export type PasscodeCheck = { ok: true } | { ok: false; message: string };

type LockContext = {
  /** Undefined until the Keychain has been read. */
  hasPasscode: boolean | undefined;
  /** The app is behind the lock screen. */
  locked: boolean;
  record: LockRecord;
  /** Face ID or Touch ID, when the iPhone has one set up. */
  biometry: Biometry | undefined;
  /** Biometrics are on in Settings, set up, and not used up. */
  canScan: boolean;
  /** Checks a passcode, counting wrong ones; a right one unlocks. */
  checkPasscode(code: string): Promise<PasscodeCheck>;
  /** One Face ID prompt. `passcode`: from now on only the passcode will do. */
  tryBiometry(reason: string): Promise<"ok" | "passcode" | "cancel" | "again">;
  setPasscode(code: string): Promise<void>;
  removePasscode(): Promise<void>;
};

const Context = createContext<LockContext | undefined>(undefined);

export const useLock = (): LockContext => {
  const value = useContext(Context);
  if (value === undefined) throw new Error("useLock outside LockProvider");
  return value;
};

/**
 * OnAir's own passcode, and Face ID or Touch ID in front of it. Locked from
 * launch when a passcode is set, and again whenever the app goes to the
 * background, so the app switcher shows the lock.
 */
export function LockProvider({ children }: { children: ReactNode }) {
  const { settings } = useSession();
  const [hasPasscode, setHasPasscode] = useState<boolean>();
  const [locked, setLocked] = useState(true);
  const [record, setRecord] = useState<LockRecord>(CLEAR_RECORD);
  const [biometry, setBiometry] = useState<Biometry>();
  const recordRef = useRef(record);

  const keep = useCallback(async (next: LockRecord) => {
    recordRef.current = next;
    setRecord(next);
    await saveRecord(next);
  }, []);

  useEffect(() => {
    void (async () => {
      const [has, stored, found] = await Promise.all([
        storedPasscode(),
        loadRecord(),
        findBiometry(),
      ]);
      recordRef.current = stored;
      setRecord(stored);
      setBiometry(found);
      setHasPasscode(has);
      setLocked(has);
    })();
  }, []);

  const hasRef = useRef(hasPasscode);
  useEffect(() => {
    hasRef.current = hasPasscode;
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background" && hasRef.current === true) setLocked(true);
    });
    return () => subscription.remove();
  }, []);

  const checkPasscode = useCallback(
    async (code: string): Promise<PasscodeCheck> => {
      const now = Date.now();
      const current = recordRef.current;
      if (current.waitUntil > now) {
        return { ok: false, message: waitText(current.waitUntil - now) };
      }
      if (await passcodeMatches(code)) {
        await keep(CLEAR_RECORD);
        setLocked(false);
        return { ok: true };
      }
      const next = afterWrongPasscode(current, now);
      await keep(next);
      return {
        ok: false,
        message:
          next.waitUntil > now
            ? `Wrong passcode. ${waitText(next.waitUntil - now)}.`
            : "Wrong passcode.",
      };
    },
    [keep],
  );

  const canScan =
    settings.useBiometrics &&
    biometry !== undefined &&
    biometricsAllowed(record);

  const tryBiometry = useCallback(
    async (reason: string) => {
      const result = await scan(reason);
      if (result === "ok") {
        await keep({ ...recordRef.current, biometricFailures: 0 });
        setLocked(false);
        return "ok" as const;
      }
      if (result === "fallback") return "passcode" as const;
      if (result === "cancel") return "cancel" as const;
      const next = afterBiometricFailure(
        recordRef.current,
        result === "lockout",
      );
      await keep(next);
      return biometricsAllowed(next)
        ? ("again" as const)
        : ("passcode" as const);
    },
    [keep],
  );

  const setPasscode = useCallback(async (code: string) => {
    await savePasscode(code);
    recordRef.current = CLEAR_RECORD;
    setRecord(CLEAR_RECORD);
    setHasPasscode(true);
    setLocked(false);
  }, []);

  const removePasscode = useCallback(async () => {
    await forgetPasscode();
    recordRef.current = CLEAR_RECORD;
    setRecord(CLEAR_RECORD);
    setHasPasscode(false);
    setLocked(false);
  }, []);

  const value = useMemo(
    () => ({
      hasPasscode,
      locked: hasPasscode === true && locked,
      record,
      biometry,
      canScan,
      checkPasscode,
      tryBiometry,
      setPasscode,
      removePasscode,
    }),
    [
      hasPasscode,
      locked,
      record,
      biometry,
      canScan,
      checkPasscode,
      tryBiometry,
      setPasscode,
      removePasscode,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
