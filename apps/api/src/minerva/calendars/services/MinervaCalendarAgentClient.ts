import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
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
