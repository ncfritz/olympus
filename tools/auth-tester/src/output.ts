import { TesterError } from "./errors";
import type { Answer } from "./http";

/** The status code an axios rejection carries, if it is one. */
export const httpStatus = (error: unknown): number | undefined => {
  const status = (error as { response?: { status?: unknown } } | undefined)
    ?.response?.status;
  return typeof status === "number" ? status : undefined;
};

/**
 * An API call, with its refusals turned into sentences.
 *
 * A 401 gets an explanation rather than a code, because there are three
 * reasons for one here and they are not interchangeable: no token, a token
 * that does not verify, and a user the directory has since disabled.
 */
export const apiCall = async <T>(
  what: string,
  call: () => Promise<T>,
): Promise<T> => {
  try {
    return await call();
  } catch (error: unknown) {
    const status = httpStatus(error);
    if (status === undefined) throw error;
    if (status === 401) {
      throw new TesterError(
        `${what}: the API would not accept the access token (401). It has expired, or the user has been disabled or removed since it was issued.`,
      );
    }
    const body = (error as { response?: { data?: unknown } }).response?.data;
    throw new TesterError(
      `${what}: the API answered ${status}${
        body === undefined || body === "" ? "" : ` ${JSON.stringify(body)}`
      }`,
    );
  }
};

/** A response as the tester prints it: the status, then the body as JSON. */
export const printAnswer = (answer: Answer): void => {
  console.log(`${answer.status}`);
  if (answer.body !== undefined && answer.body !== "") {
    console.log(
      typeof answer.body === "string"
        ? answer.body
        : JSON.stringify(answer.body, null, 2),
    );
  }
};

export const printUser = (user: {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}): void => {
  console.log(`  user    ${user.email} (${user.displayName})`);
  console.log(`  id      ${user.id}`);
  console.log(
    `  roles   ${user.roles.length > 0 ? user.roles.join(", ") : "(none)"}`,
  );
};

export type PrintableSession = {
  id: string;
  clientId: string;
  deviceName?: string;
  current: boolean;
  createdTime: string;
  lastUsedTime?: string;
  expiresTime: string;
};

export const printSessions = (sessions: PrintableSession[]): void => {
  if (sessions.length === 0) {
    // Not possible from a call that needed a token, which is worth saying.
    console.log("No live sessions, which cannot be true of the caller's own.");
    return;
  }
  for (const session of sessions) {
    console.log(
      `${session.current ? "*" : " "} ${session.id}  ${session.clientId}${
        session.deviceName === undefined ? "" : `  "${session.deviceName}"`
      }${session.current ? "  (this one)" : ""}`,
    );
    console.log(
      `    signed in ${session.createdTime}  last used ${
        session.lastUsedTime ?? "never"
      }  expires ${session.expiresTime}`,
    );
  }
};

/**
 * Why a call the API ought to have refused was served anyway.
 *
 * Report mode (ADR 0018): until phase 8 the guard resolves the caller,
 * records what it would have rejected and lets the request through. So the
 * one thing a test of a rejection must not do is read the status code -- a
 * 200 here is the guard agreeing with you, not disagreeing, and without this
 * note it reads as the check not existing.
 */
export const reportModeNote = (
  sent: string,
  certificate: string,
  status: number,
): string | undefined =>
  sent === certificate || status >= 400
    ? undefined
    : [
        `The header said ${sent} and the certificate said ${certificate}, and the call was served.`,
        'That is report mode: the guard recorded auth_decisions_total{listener="services",outcome="would_reject",reason="client header mismatch"}',
        "rather than refusing it. `curl -s <api>/metrics | grep auth_decisions_total` has the count;",
        "AUTH_MODE_SERVICES=enforce is what turns it into a 401.",
      ].join(" ");
