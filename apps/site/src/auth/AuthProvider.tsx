import type { CurrentUser } from "@ncfritz/olympus-sdk/olympus";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import authApi from "../api/authApi";
import { pageSession as session } from "./pageSession";
import { isCallbackPath } from "./signIn";
import type { Session } from "./session";

export type AuthState =
  /** Asking the API whether the refresh cookie is still good. */
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: CurrentUser };

export type Auth = AuthState & {
  session: Session;
  /** Ends the session at the API, which also clears the cookie. */
  signOut(): Promise<void>;
  /** Re-reads the user, for when roles change under them. */
  reload(): Promise<void>;
};

const AuthContext = createContext<Auth | undefined>(undefined);

export const useAuth = (): Auth => {
  const auth = useContext(AuthContext);
  if (auth === undefined) {
    throw new Error("useAuth was called outside AuthProvider");
  }
  return auth;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let current = true;

    const settle = async () => {
      const user = await describeSelf();
      // The tab can be closed, or sign out, while this is in flight; the answer
      // to a question nobody is asking any more is dropped.
      if (current) {
        setState(
          user === undefined
            ? { status: "signed-out" }
            : { status: "signed-in", user },
        );
      }
    };

    // On the callback page the session comes from the code exchange, not from
    // the cookie (see isCallbackPath), so this waits for it instead of asking
    // for one in parallel. Nothing off /auth/ renders until it arrives, and the
    // callback page shows its own progress and its own errors meanwhile.
    if (isCallbackPath(window.location.pathname)) {
      if (session.held() !== undefined) {
        void settle();
        return () => {
          current = false;
        };
      }
      const stop = session.watch((held) => {
        if (held === undefined) return;
        stop();
        void settle();
      });
      return () => {
        current = false;
        stop();
      };
    }

    void (async () => {
      // The refresh cookie is httpOnly, so the only way to know whether this
      // browser is signed in is to ask the API to use it.
      const restored = await session.restore();
      if (!restored) {
        if (current) setState({ status: "signed-out" });
        return;
      }
      await settle();
    })();
    return () => {
      current = false;
    };
  }, []);

  const auth = useMemo<Auth>(
    () => ({
      ...state,
      session,
      signOut: async () => {
        try {
          await authApi.signOut();
        } finally {
          // Whatever the API said: the page holds no usable token either way,
          // and leaving it signed in because sign-out failed is the worse end.
          session.hold(undefined);
          setState({ status: "signed-out" });
        }
      },
      reload: async () => {
        const user = await describeSelf();
        setState(
          user === undefined
            ? { status: "signed-out" }
            : { status: "signed-in", user },
        );
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

/** The user as the API sees them now, or nothing if it will not say. */
const describeSelf = async (): Promise<CurrentUser | undefined> => {
  try {
    return (await authApi.describeCurrentUser()).data.user;
  } catch {
    // A 401 here means the access token was refused a moment after being
    // issued: the user was disabled or removed. Signed out, not an error page.
    return undefined;
  }
};
