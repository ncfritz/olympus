/**
 * A console's sign-in through Olympus (ADR 0029), as the service behind
 * the console takes part in it: which client of the API's it is, where it
 * is published, and the names of its cookies.
 */
export type ConsoleSessionConfig = {
  /** This console, as the API's client registry knows it: `minerva-calendar-console`. */
  clientId: string;
  /** What the API's session list calls this console's sessions. */
  deviceName: string;
  /** The cookies' prefix: `minerva` gives `minerva_access_token`. */
  cookiePrefix: string;
  /**
   * Where the browser reaches this service (AUTH_BASE_URL); the sign-in's
   * redirect URI, `<baseUrl>/auth/callback`, is built from it.
   */
  baseUrl: string;
  /** The console's own URL (WEB_APP_URL): the cookies' path, CORS, and the only allowed returnTo. */
  webAppUrl?: string;
  olympus: {
    /** Where this service reaches the Olympus API (OLYMPUS_API_URL). */
    apiUrl: string;
    /** Where a browser reaches it to sign in (OLYMPUS_SIGN_IN_URL). */
    signInUrl: string;
  };
};

/** The injection token for the module's configuration. */
export const CONSOLE_SESSION_CONFIG = Symbol("CONSOLE_SESSION_CONFIG");
