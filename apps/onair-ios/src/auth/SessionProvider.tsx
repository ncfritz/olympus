import type { Availability } from "@ncfritz/olympus-sdk/minerva";
import Constants from "expo-constants";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiBaseUrl } from "../config";
import { dayAround } from "../time";
import { createCaller } from "./caller";
import { classifyFailure } from "./failure";
import { signIn } from "./signIn";
import { clearTokens, loadTokens, saveTokens } from "./storage";

export type AppState =
  /** Reading the Keychain and loading today: the loading screen. */
  | { phase: "starting" }
  | { phase: "signed-out"; problem?: string; signingIn: boolean }
  | { phase: "ready"; availability: Availability; loadedAt: Date }
  /** Signed in, but the API could not be reached: the tokens are kept. */
  | { phase: "unreachable"; message: string };

type SessionContext = {
  state: AppState;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Loads today again: Retry, pull to refresh, the 30-second timer. */
  reload(): Promise<void>;
};

const Context = createContext<SessionContext | undefined>(undefined);

export const useSession = (): SessionContext => {
  const value = useContext(Context);
  if (value === undefined) {
    throw new Error("useSession is used outside SessionProvider");
  }
  return value;
};

const timeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function SessionProvider({ children }: { children: ReactNode }) {
  // Expo inlines EXPO_PUBLIC_ variables at build time, by this exact name.
  const caller = useMemo(
    () =>
      createCaller(apiBaseUrl(process.env.EXPO_PUBLIC_OLYMPUS_API_BASE_URL)),
    [],
  );
  const [state, setState] = useState<AppState>({ phase: "starting" });

  const signedOut = useCallback(
    async (problem?: string) => {
      caller.session.hold(undefined);
      await clearTokens(caller.baseUrl);
      setState({
        phase: "signed-out",
        signingIn: false,
        ...(problem === undefined ? {} : { problem }),
      });
    },
    [caller],
  );

  const reload = useCallback(async () => {
    const { start, end } = dayAround(new Date());
    try {
      const availability = await caller.availability.getAvailability(
        start,
        end,
        { timeZone: timeZone() },
      );
      setState({ phase: "ready", availability, loadedAt: new Date() });
    } catch (error) {
      const failure = classifyFailure(error);
      if (failure.kind === "signed-out") {
        await signedOut(failure.message);
      } else {
        setState({ phase: "unreachable", message: failure.message });
      }
    }
  }, [caller, signedOut]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tokens = await loadTokens(caller.baseUrl);
      if (cancelled) return;
      if (tokens === undefined) {
        setState({ phase: "signed-out", signingIn: false });
        return;
      }
      caller.session.hold(tokens);
      await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [caller, reload]);

  const startSignIn = useCallback(async () => {
    setState({ phase: "signed-out", signingIn: true });
    try {
      const outcome = await signIn({
        apiBaseUrl: caller.baseUrl,
        deviceName: Constants.deviceName ?? "iPhone",
      });
      if (outcome.outcome === "cancelled") {
        setState({ phase: "signed-out", signingIn: false });
        return;
      }
      if (outcome.outcome === "refused") {
        setState({
          phase: "signed-out",
          signingIn: false,
          problem: outcome.reason,
        });
        return;
      }
      await saveTokens(caller.baseUrl, outcome.tokens);
      caller.session.hold(outcome.tokens);
      setState({ phase: "starting" });
      await reload();
    } catch (error) {
      setState({
        phase: "signed-out",
        signingIn: false,
        problem: classifyFailure(error).message,
      });
    }
  }, [caller, reload]);

  const signOut = useCallback(async () => {
    try {
      // Ends the session at the API too, so its refresh token is dead.
      await caller.auth.signOut();
    } catch {
      // Offline, or already ended: the local sign-out still happens.
    }
    await signedOut();
  }, [caller, signedOut]);

  const value = useMemo(
    () => ({ state, signIn: startSignIn, signOut, reload }),
    [state, startSignIn, signOut, reload],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
