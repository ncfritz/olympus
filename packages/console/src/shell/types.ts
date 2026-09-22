import type { ReactNode } from "react";

/** One of the current console's own pages, in the header's strip. */
export interface ShellTab {
  /** Matched against `activeTab`; the console's route is the obvious choice. */
  key: string;
  /** Usually a `next/link` — the shell does not route, the console does. */
  label: ReactNode;
  title?: string;
}

/** A way in, on the sign-in screen. */
export interface SignInProvider {
  /** The agent's OIDC provider name, as registered: `google`. */
  name: string;
  label: string;
  icon?: ReactNode;
}
