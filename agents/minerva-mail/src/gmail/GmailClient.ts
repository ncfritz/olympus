import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import { gmailConfig, type GmailConfigType } from "../config/configuration";
import { GmailCredentialStore } from "./GmailCredentialStore";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Gmail's quota is 250 units a second per user; a list or get costs 5. */
export const DEFAULT_INTERVAL_MS = 50;
const MAX_TRIES = 6;

export type GmailProfile = {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
};

export type GmailLabelInfo = {
  id: string;
  name: string;
  type: "user" | "system";
};

export type GmailRawMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  /** Milliseconds since the epoch, as a string. */
  internalDate: string;
  /** base64url of the RFC 822 text. */
  raw: string;
};

/** A message as a history record names it. */
export type GmailHistoryMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
};

/** One change to the mailbox (history.list's record). */
export type GmailHistoryRecord = {
  id: string;
  messagesAdded?: { message: GmailHistoryMessage }[];
  messagesDeleted?: { message: GmailHistoryMessage }[];
  labelsAdded?: { message: GmailHistoryMessage; labelIds: string[] }[];
  labelsRemoved?: { message: GmailHistoryMessage; labelIds: string[] }[];
};

/** The status Google answered a failed request with, if any. */
export const gmailStatusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number }; status?: number })?.response
    ?.status ?? (error as { status?: number })?.status;

/** How a request is sent; separate so tests can stand in for Google. */
export type GmailTransport = <T>(
  url: string,
  params: Record<string, string | number | boolean | string[] | undefined>,
) => Promise<T>;

/** A pause between requests, shared by every call through one mailbox. */
class Throttle {
  private next = 0;
  constructor(private readonly intervalMs: number) {}

  async take(): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + this.intervalMs;
    if (at > now) await new Promise((r) => setTimeout(r, at - now));
  }
}

const statusOf = gmailStatusOf;

const reasonOf = (error: unknown): string | undefined =>
  (
    error as {
      response?: { data?: { error?: { errors?: { reason?: string }[] } } };
    }
  )?.response?.data?.error?.errors?.[0]?.reason;

/** Worth another try: Google's rate limits and its own failures. */
const retryable = (error: unknown): boolean => {
  const status = statusOf(error);
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  const reason = reasonOf(error);
  return (
    status === 403 &&
    (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded")
  );
};

/**
 * One linked mailbox's Gmail API, read-only (gmail.readonly): throttled to
 * stay inside Gmail's per-user quota, and retried with backoff when Google
 * says to slow down or fails. The access token is refreshed from the stored
 * refresh token as it expires.
 */
export class GmailMailbox {
  private readonly logger = new Logger(GmailMailbox.name);
  private readonly throttle: Throttle;
  /** Requests sent, retries included: what counts against the quota. */
  requests = 0;

  constructor(
    private readonly transport: GmailTransport,
    intervalMs = DEFAULT_INTERVAL_MS,
    private readonly sleep = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms)),
  ) {
    this.throttle = new Throttle(intervalMs);
  }

  private async get<T>(
    path: string,
    params: Record<
      string,
      string | number | boolean | string[] | undefined
    > = {},
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      await this.throttle.take();
      this.requests++;
      try {
        return await this.transport<T>(`${API}${path}`, params);
      } catch (error) {
        if (!retryable(error) || attempt >= MAX_TRIES) throw error;
        const wait = Math.min(32_000, 1000 * 2 ** (attempt - 1));
        this.logger.warn(
          `Gmail ${path} answered ${statusOf(error) ?? "an error"}; trying again in ${wait / 1000} s`,
        );
        await this.sleep(wait);
      }
    }
  }

  profile(): Promise<GmailProfile> {
    return this.get<GmailProfile>("/profile");
  }

  async labels(): Promise<GmailLabelInfo[]> {
    const body = await this.get<{
      labels?: { id: string; name: string; type?: string }[];
    }>("/labels");
    return (body.labels ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type === "user" ? "user" : "system",
    }));
  }

  /** A label's message and thread counts, as Gmail keeps them. */
  async labelTotals(
    id: string,
  ): Promise<{ messagesTotal: number; threadsTotal: number }> {
    const body = await this.get<{
      messagesTotal?: number;
      threadsTotal?: number;
    }>(`/labels/${id}`);
    return {
      messagesTotal: body.messagesTotal ?? 0,
      threadsTotal: body.threadsTotal ?? 0,
    };
  }

  /**
   * Every message ID with the label (or in the mailbox, without one),
   * Trash and Spam left out as Gmail leaves them out.
   */
  async messageIds(labelId?: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const body = await this.get<{
        messages?: { id: string }[];
        nextPageToken?: string;
      }>("/messages", {
        maxResults: 500,
        ...(labelId ? { labelIds: labelId } : {}),
        ...(pageToken ? { pageToken } : {}),
      });
      for (const m of body.messages ?? []) ids.push(m.id);
      pageToken = body.nextPageToken;
    } while (pageToken);
    return ids;
  }

  /**
   * Every change since `startHistoryId`, oldest first, and the mailbox's
   * historyId now, to carry on from. Gmail answers 404 when the history
   * that far back is gone (it keeps about a week): reconcile instead.
   */
  async history(
    startHistoryId: string,
  ): Promise<{ historyId: string; records: GmailHistoryRecord[] }> {
    const records: GmailHistoryRecord[] = [];
    let historyId = startHistoryId;
    let pageToken: string | undefined;
    do {
      const body = await this.get<{
        history?: GmailHistoryRecord[];
        historyId?: string;
        nextPageToken?: string;
      }>("/history", {
        startHistoryId,
        maxResults: 500,
        ...(pageToken ? { pageToken } : {}),
      });
      records.push(...(body.history ?? []));
      if (body.historyId) historyId = body.historyId;
      pageToken = body.nextPageToken;
    } while (pageToken);
    return { historyId, records };
  }

  /** A message's label IDs alone (format minimal). */
  minimal(id: string): Promise<{ id: string; labelIds?: string[] }> {
    return this.get<{ id: string; labelIds?: string[] }>(`/messages/${id}`, {
      format: "minimal",
    });
  }

  /** A message's RFC 822 text and Gmail's facts about it. */
  raw(id: string): Promise<GmailRawMessage> {
    return this.get<GmailRawMessage>(`/messages/${id}`, { format: "raw" });
  }
}

/** Opens linked mailboxes from their stored refresh tokens. */
@Injectable()
export class GmailClient {
  constructor(
    @Inject(gmailConfig.KEY) private readonly config: GmailConfigType,
    private readonly credentials: GmailCredentialStore,
  ) {}

  /** @throws ServiceUnavailableException no client, or the mailbox is not linked */
  mailbox(email: string, intervalMs = DEFAULT_INTERVAL_MS): GmailMailbox {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new ServiceUnavailableException(
        "Gmail's OAuth client is not configured (MAIL_GOOGLE_OAUTH_CLIENT_ID and _SECRET)",
      );
    }
    const credential = this.credentials.load(email);
    if (!credential) {
      throw new ServiceUnavailableException(
        `${email} is not linked to Gmail: link it from Minerva's Mail inbox first`,
      );
    }
    const client = new OAuth2Client(
      this.config.clientId,
      this.config.clientSecret,
    );
    client.setCredentials({ refresh_token: credential.refreshToken });
    const transport: GmailTransport = async <T>(
      url: string,
      params: Record<string, string | number | boolean | string[] | undefined>,
    ) => (await client.request<T>({ url, params })).data;
    return new GmailMailbox(transport, intervalMs);
  }
}
