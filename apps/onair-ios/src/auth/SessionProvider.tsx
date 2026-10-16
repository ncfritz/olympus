import type {
  AvailabilityLevel,
  Availability,
  BaseAvailabilityBlock,
  Calendar,
  PartialAvailabilityBlock,
} from "@ncfritz/olympus-sdk/minerva";
import Constants from "expo-constants";
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
import { AppState as AppLifecycle } from "react-native";

import { apiBaseUrl } from "../config";
import { hideCalendars, loadWindow } from "../schedule";
import {
  DEFAULT_SETTINGS,
  type WorkSettings,
  workingDayQuery,
} from "../settings";
import { loadSettings, saveSettings } from "../settingsStore";
import { createCaller } from "./caller";
import { classifyFailure } from "./failure";
import { signIn } from "./signIn";
import { clearTokens, loadTokens, saveTokens } from "./storage";

export type AppState =
  /** Reading the Keychain and loading: the loading screen. */
  | { phase: "starting" }
  | { phase: "signed-out"; problem?: string; signingIn: boolean }
  /**
   * Loaded: a week back to two weeks ahead. `problem` is set when a later
   * refresh failed, so the screens can say the data is from `loadedAt`.
   */
  | {
      phase: "ready";
      availability: Availability;
      loadedAt: Date;
      problem?: string;
    }
  /** Signed in, but the first load could not reach the API: tokens kept. */
  | { phase: "unreachable"; message: string };

type SessionContext = {
  state: AppState;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Loads again: Retry, Refresh, the 30-second timer, coming to the front. */
  reload(): Promise<void>;
  /** A meeting's level, or `undefined` to follow its calendar again. */
  setMeetingLevel(
    meetingId: string,
    level: AvailabilityLevel | undefined,
  ): Promise<void>;
  /** A new override, or changes to one. */
  saveBlock(block: BaseAvailabilityBlock | BlockChanges): Promise<void>;
  deleteBlock(blockId: string): Promise<void>;
  /** The working day the availability is read against (Settings). */
  settings: WorkSettings;
  /** Keeps new settings on the phone and reloads against them. */
  updateSettings(settings: WorkSettings): Promise<void>;
  /** The synced calendars (Settings). */
  listCalendars(): Promise<Calendar[]>;
  /** Whether a calendar counts toward busy: on the server, for everyone. */
  setCalendarCounted(calendarId: string, counted: boolean): Promise<void>;
};

/**
 * Changes to an override. The API takes a null label to remove it; the
 * generated type leaves the null out, so it is added here.
 */
export type BlockChanges = Omit<PartialAvailabilityBlock, "label"> & {
  id: string;
  label?: string | null;
};

const Context = createContext<SessionContext | undefined>(undefined);

export const useSession = (): SessionContext => {
  const value = useContext(Context);
  if (value === undefined) {
    throw new Error("useSession is used outside SessionProvider");
  }
  return value;
};

/** The ready state, for screens that only render once loaded. */
export const useReady = () => {
  const session = useSession();
  // Calendars hidden on this phone drop out of every screen's meetings.
  return session.state.phase === "ready"
    ? {
        ...session,
        state: {
          ...session.state,
          availability: hideCalendars(
            session.state.availability,
            session.settings.hiddenCalendars,
          ),
        },
      }
    : undefined;
};

const timeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** As often as the site's OnAir drawer refreshes. */
const REFRESH_MS = 30_000;

export function SessionProvider({ children }: { children: ReactNode }) {
  // Expo inlines EXPO_PUBLIC_ variables at build time, by this exact name.
  const caller = useMemo(
    () =>
      createCaller(apiBaseUrl(process.env.EXPO_PUBLIC_OLYMPUS_API_BASE_URL)),
    [],
  );
  const [state, setState] = useState<AppState>({ phase: "starting" });
  const [settings, setSettings] = useState<WorkSettings>(DEFAULT_SETTINGS);
  // Read by reload, so a change takes effect without remaking it.
  const settingsRef = useRef<WorkSettings>(DEFAULT_SETTINGS);

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
    const { start, end } = loadWindow(new Date());
    try {
      const availability = await caller.availability.getAvailability(
        start,
        end,
        { timeZone: timeZone(), ...workingDayQuery(settingsRef.current) },
      );
      setState({ phase: "ready", availability, loadedAt: new Date() });
    } catch (error) {
      const failure = classifyFailure(error);
      if (failure.kind === "signed-out") {
        await signedOut(failure.message);
        return;
      }
      // Already showing data: keep it, and say it may be out of date.
      setState((previous) =>
        previous.phase === "ready"
          ? { ...previous, problem: failure.message }
          : { phase: "unreachable", message: failure.message },
      );
    }
  }, [caller, signedOut]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [tokens, stored] = await Promise.all([
        loadTokens(caller.baseUrl),
        loadSettings(),
      ]);
      if (cancelled) return;
      settingsRef.current = stored;
      setSettings(stored);
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

  // Every 30 seconds while signed in, and on coming back to the front.
  const signedIn = state.phase === "ready" || state.phase === "unreachable";
  useEffect(() => {
    if (!signedIn) return;
    const timer = setInterval(() => void reload(), REFRESH_MS);
    const lifecycle = AppLifecycle.addEventListener("change", (next) => {
      if (next === "active") void reload();
    });
    return () => {
      clearInterval(timer);
      lifecycle.remove();
    };
  }, [signedIn, reload]);

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

  /**
   * An edit, then a reload so every screen shows what the API now says
   * (the levels of the slots around it change too). A failure is thrown to
   * the screen that asked, which says so; a 401 also signs out.
   */
  const edit = useCallback(
    async (change: () => Promise<unknown>) => {
      try {
        await change();
      } catch (error) {
        const failure = classifyFailure(error);
        if (failure.kind === "signed-out") await signedOut(failure.message);
        throw new Error(failure.message, { cause: error });
      }
      await reload();
    },
    [reload, signedOut],
  );

  const setMeetingLevel = useCallback(
    (meetingId: string, level: AvailabilityLevel | undefined) =>
      edit(() =>
        level === undefined
          ? caller.availability.clearMeetingAvailability(meetingId)
          : caller.availability.setMeetingAvailability(meetingId, level),
      ),
    [caller, edit],
  );

  const saveBlock = useCallback(
    (block: BaseAvailabilityBlock | BlockChanges) =>
      edit(() => {
        if ("id" in block) {
          const { id, ...changes } = block;
          return caller.availability.updateAvailabilityBlock(
            id,
            changes as PartialAvailabilityBlock,
          );
        }
        return caller.availability.createAvailabilityBlock(block);
      }),
    [caller, edit],
  );

  const deleteBlock = useCallback(
    (blockId: string) =>
      edit(() => caller.availability.deleteAvailabilityBlock(blockId)),
    [caller, edit],
  );

  const listCalendars = useCallback(async () => {
    try {
      return await caller.availability.listCalendars();
    } catch (error) {
      const failure = classifyFailure(error);
      if (failure.kind === "signed-out") await signedOut(failure.message);
      throw new Error(failure.message, { cause: error });
    }
  }, [caller, signedOut]);

  const setCalendarCounted = useCallback(
    (calendarId: string, counted: boolean) =>
      edit(() =>
        caller.availability.updateCalendar(calendarId, {
          includedInBusy: counted,
        }),
      ),
    [caller, edit],
  );

  const updateSettings = useCallback(
    async (next: WorkSettings) => {
      settingsRef.current = next;
      setSettings(next);
      await saveSettings(next);
      await reload();
    },
    [reload],
  );

  const value = useMemo(
    () => ({
      state,
      signIn: startSignIn,
      signOut,
      reload,
      setMeetingLevel,
      saveBlock,
      deleteBlock,
      settings,
      updateSettings,
      listCalendars,
      setCalendarCounted,
    }),
    [
      state,
      startSignIn,
      signOut,
      reload,
      setMeetingLevel,
      saveBlock,
      deleteBlock,
      settings,
      updateSettings,
      listCalendars,
      setCalendarCounted,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
