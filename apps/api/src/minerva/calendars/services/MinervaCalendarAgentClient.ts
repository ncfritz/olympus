import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import axios, { type AxiosInstance, isAxiosError } from "axios";
import * as fs from "fs";
import * as https from "https";
import {
  minervaConfig,
  type MinervaConfigType,
} from "../../../config/configuration";

/** The caller name the agent labels its request metrics with. */
const CLIENT_NAME = "olympus-api";

/** A calendar account as the agent's ListCalendarAccounts reports it. */
export type AgentCalendarAccount = {
  accountLabel: string;
  provider: "google" | "microsoft";
  subject?: string;
  sources: string[];
  status: "ok" | "expired" | "reauth_pending" | "not_connected" | "error";
  scope?: string;
  obtainedAt?: string;
  accessTokenExpiresAt?: string;
  error?: string;
};

export type AgentProvider = "google" | "microsoft";

/** A synced calendar as the agent's ListCalendars reports it. */
export type AgentCalendar = {
  provider: AgentProvider;
  accountLabel: string;
  calendarId: string;
  source: string;
  synced: boolean;
  enablePush: boolean;
  enabled: boolean;
  lastSyncedAt?: string;
  syncing: boolean;
  includedInBusy: boolean;
};

/** A calendar an account's provider reports. */
export type AgentAvailableCalendar = {
  id: string;
  summary: string;
  alreadySynced: boolean;
};

/** Who signed in at the end of a web sign-in. */
export type AgentWebSignInResult = {
  provider: AgentProvider;
  accountLabel: string;
  subject?: string;
  created: boolean;
};

/**
 * The calendar sync agent's management API, called on the agent's
 * services listener with the API's client certificate (ADR 0028). The API
 * is its only caller: users reach calendar accounts through the API, which
 * checks ownership first.
 *
 * Unconfigured (no MINERVA_CALENDAR_AGENT_URL), every call is a 503; an
 * agent that fails or cannot be reached is a 502.
 */
@Injectable()
export class MinervaCalendarAgentClient {
  private readonly logger = new Logger(MinervaCalendarAgentClient.name);
  private readonly http?: AxiosInstance;

  constructor(@Inject(minervaConfig.KEY) minerva: MinervaConfigType) {
    const agent = minerva.calendarAgent;
    if (!agent) return;
    this.http = axios.create({
      baseURL: agent.baseUrl,
      timeout: agent.timeoutMs,
      headers: { [CLIENT_HEADER]: CLIENT_NAME },
      // One handshake, then every call reuses the connection.
      httpsAgent: agent.tls
        ? new https.Agent({
            keepAlive: true,
            cert: fs.readFileSync(agent.tls.certificate),
            key: fs.readFileSync(agent.tls.key),
            ca: agent.tls.ca ? fs.readFileSync(agent.tls.ca) : undefined,
          })
        : undefined,
    });
  }

  /** Every account the agent holds a credential for, or syncs a calendar of. */
  async listCalendarAccounts(): Promise<AgentCalendarAccount[]> {
    const body = await this.call<{ calendarAccounts: AgentCalendarAccount[] }>(
      "ListCalendarAccounts",
      (http) => http.get("/calendar-accounts"),
    );
    return body.calendarAccounts;
  }

  /** The provider's sign-in URL for a sign-in the API started (ADR 0028). */
  async startWebSignIn(webSignIn: {
    provider: AgentProvider;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    accountLabel?: string;
  }): Promise<string> {
    const body = await this.call<{ authUrl: string }>(
      "StartCalendarAccountWebSignIn",
      (http) => http.post("/calendar-account-web-sign-ins", { webSignIn }),
    );
    return body.authUrl;
  }

  /**
   * Redeems the provider's redirect. Another account signing in again is a
   * 409 from the agent, passed on as one.
   */
  async completeWebSignIn(callback: {
    provider: AgentProvider;
    callbackUrl: string;
    redirectUri: string;
    state: string;
    codeVerifier: string;
    accountLabel?: string;
  }): Promise<AgentWebSignInResult> {
    const body = await this.call<{ calendarAccount: AgentWebSignInResult }>(
      "CompleteCalendarAccountWebSignIn",
      (http) =>
        http.post("/calendar-account-web-sign-ins/complete", { callback }),
    );
    return body.calendarAccount;
  }

  /** Stops the account's calendars and deletes its credential. */
  async deleteCalendarAccount(
    provider: AgentProvider,
    accountLabel: string,
  ): Promise<void> {
    await this.call("DeleteCalendarAccount", (http) =>
      http.delete(`/calendar-account/${encodeURIComponent(accountLabel)}`, {
        params: { provider },
      }),
    );
  }

  async listAvailableCalendars(
    provider: AgentProvider,
    accountLabel: string,
  ): Promise<AgentAvailableCalendar[]> {
    const body = await this.call<{
      availableCalendars: AgentAvailableCalendar[];
    }>("ListAvailableCalendars", (http) =>
      http.get(
        `/calendar-account/${encodeURIComponent(accountLabel)}/calendars`,
        { params: { provider } },
      ),
    );
    return body.availableCalendars;
  }

  async listCalendars(): Promise<AgentCalendar[]> {
    const body = await this.call<{ calendars: AgentCalendar[] }>(
      "ListCalendars",
      (http) => http.get("/calendars"),
    );
    return body.calendars;
  }

  /** A source another calendar has is a 409 from the agent, passed on. */
  async createCalendar(calendar: {
    provider: AgentProvider;
    accountLabel: string;
    calendarId: string;
    source: string;
  }): Promise<AgentCalendar> {
    const body = await this.call<{ calendar: AgentCalendar }>(
      "CreateCalendar",
      (http) => http.post("/calendars", { calendar }),
    );
    return body.calendar;
  }

  async updateCalendar(
    calendarId: string,
    calendar: { enabled?: boolean; includedInBusy?: boolean },
  ): Promise<AgentCalendar> {
    const body = await this.call<{ calendar: AgentCalendar }>(
      "UpdateCalendar",
      (http) =>
        http.put(`/calendar/${encodeURIComponent(calendarId)}`, { calendar }),
    );
    return body.calendar;
  }

  async deleteCalendar(calendarId: string): Promise<void> {
    await this.call("DeleteCalendar", (http) =>
      http.delete(`/calendar/${encodeURIComponent(calendarId)}`),
    );
  }

  /** Publishes every event of the calendar again (phase 5's backfill on link). */
  async backfillCalendar(calendarId: string): Promise<void> {
    await this.call("BackfillCalendar", (http) =>
      http.post(`/calendar/${encodeURIComponent(calendarId)}/backfill`),
    );
  }

  private async call<T>(
    operation: string,
    send: (http: AxiosInstance) => Promise<{ data: T }>,
  ): Promise<T> {
    if (!this.http) {
      throw new ServiceUnavailableException(
        "The calendar sync agent is not configured",
      );
    }
    try {
      return (await send(this.http)).data;
    } catch (error) {
      // What the agent refused on its merits is passed on as itself; what
      // it failed to do is the agent's failure, a 502.
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message = agentMessage(error);
      if (status === 400) throw new BadRequestException(message);
      if (status === 404) throw new NotFoundException(message);
      if (status === 409) throw new ConflictException(message);
      const detail = isAxiosError(error)
        ? error.response
          ? `${error.response.status}`
          : (error.code ?? error.message)
        : String(error);
      this.logger.warn(
        `${operation} on the calendar sync agent failed: ${detail}`,
      );
      throw new BadGatewayException(
        `The calendar sync agent could not ${operation}`,
      );
    }
  }
}

/** The message of the agent's error body, when it has one. */
const agentMessage = (error: unknown): string | undefined => {
  if (!isAxiosError(error)) return undefined;
  const data = error.response?.data as { message?: unknown } | undefined;
  return typeof data?.message === "string" ? data.message : undefined;
};
