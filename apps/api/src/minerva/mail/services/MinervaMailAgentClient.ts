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

/** Who signed in at the end of a Gmail sign-in. */
export type AgentGmailSignIn = {
  email: string;
  subject: string;
  scope: string;
  /** Whether the agent held no credential for the mailbox before. */
  created: boolean;
};

/**
 * The mail agent's management API, on its services listener with the API's
 * client certificate (ADR 0030, by ADR 0028's pattern). The API is its only
 * caller; users reach it through the API, which checks ownership first.
 *
 * Unconfigured (no MINERVA_MAIL_AGENT_URL), every call is a 503; an agent
 * that fails or cannot be reached is a 502.
 */
@Injectable()
export class MinervaMailAgentClient {
  private readonly logger = new Logger(MinervaMailAgentClient.name);
  private readonly http?: AxiosInstance;

  constructor(@Inject(minervaConfig.KEY) minerva: MinervaConfigType) {
    const agent = minerva.mailAgent;
    if (!agent) return;
    this.http = axios.create({
      baseURL: agent.baseUrl,
      timeout: agent.timeoutMs,
      headers: { [CLIENT_HEADER]: CLIENT_NAME },
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

  /** Google's consent URL for a sign-in the API started. */
  async startSignIn(signIn: {
    redirectUri: string;
    state: string;
    codeChallenge: string;
    email: string;
  }): Promise<string> {
    const body = await this.call<{ authUrl: string }>(
      "StartGmailSignIn",
      (http) => http.post("/gmail-sign-ins", signIn),
    );
    return body.authUrl;
  }

  /**
   * Redeems Google's redirect. Another account than the mailbox is a 409
   * from the agent, passed on as one.
   */
  async completeSignIn(callback: {
    callbackUrl: string;
    redirectUri: string;
    state: string;
    codeVerifier: string;
    email: string;
  }): Promise<AgentGmailSignIn> {
    const body = await this.call<{ account: AgentGmailSignIn }>(
      "CompleteGmailSignIn",
      (http) => http.post("/gmail-sign-ins/complete", callback),
    );
    return body.account;
  }

  /** Forgets a mailbox's credential at the agent. */
  async deleteAccount(email: string): Promise<void> {
    await this.call("DeleteGmailAccount", (http) =>
      http.delete(`/gmail-account/${encodeURIComponent(email)}`),
    );
  }

  private async call<T>(
    operation: string,
    send: (http: AxiosInstance) => Promise<{ data: T }>,
  ): Promise<T> {
    if (!this.http) {
      throw new ServiceUnavailableException(
        "The mail agent is not configured (MINERVA_MAIL_AGENT_URL)",
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
      if (status === 503) throw new ServiceUnavailableException(message);
      const detail = isAxiosError(error)
        ? error.response
          ? `${error.response.status}`
          : (error.code ?? error.message)
        : String(error);
      this.logger.warn(`${operation} on the mail agent failed: ${detail}`);
      throw new BadGatewayException(`The mail agent could not ${operation}`);
    }
  }
}

const agentMessage = (error: unknown): string | undefined => {
  if (!isAxiosError(error)) return undefined;
  const data = error.response?.data as { message?: unknown } | undefined;
  return typeof data?.message === "string" ? data.message : undefined;
};
