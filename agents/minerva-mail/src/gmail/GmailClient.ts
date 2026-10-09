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
  /** A POST's or PATCH's body; a GET has none. */
  body?: unknown,
  /** GET without a body, POST with one, unless said otherwise. */
  method?: "PATCH" | "DELETE",
) => Promise<T>;

/** messages.batchModify takes at most this many IDs a call. */
export const BATCH_MODIFY_IDS = 1000;

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

  private async send<T>(
    path: string,
    params: Record<
      string,
      string | number | boolean | string[] | undefined
    > = {},
    body?: unknown,
    method?: "PATCH" | "DELETE",
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      await this.throttle.take();
      this.requests++;
      try {
        return await this.transport<T>(`${API}${path}`, params, body, method);
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

  /**
   * Adds and removes labels on up to 1,000 messages at once (gmail.modify).
   * Safe to retry: adding a label a message has, or removing one it lacks,
   * changes nothing.
   */
  async batchModify(
    ids: string[],
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void> {
    if (ids.length < 1 || ids.length > BATCH_MODIFY_IDS) {
      throw new Error(`batchModify takes 1 to ${BATCH_MODIFY_IDS} IDs`);
    }
    await this.send<unknown>(
      "/messages/batchModify",
      {},
      { ids, addLabelIds, removeLabelIds },
    );
  }

  /** Makes a user label, shown in the label list and on messages. */
  async createLabel(name: string): Promise<GmailLabelInfo> {
    const label = await this.send<{ id: string; name: string }>(
      "/labels",
      {},
      { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
    );
    return { id: label.id, name: label.name, type: "user" };
  }

  /** Renames a user label; its messages keep it. */
  async renameLabel(id: string, name: string): Promise<void> {
    await this.send<unknown>(`/labels/${id}`, {}, { name }, "PATCH");
  }

  /**
   * Makes a filter (gmail.settings.basic): mail from `from` gets the
   * labels added and removed as it arrives. Its ID.
   */
  async createFilter(
    from: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<string> {
    const filter = await this.send<{ id: string }>(
      "/settings/filters",
      {},
      { criteria: { from }, action: { addLabelIds, removeLabelIds } },
    );
    return filter.id;
  }

  /** Deletes a filter; mail it labelled keeps its labels. */
  async deleteFilter(id: string): Promise<void> {
    await this.send<unknown>(
      `/settings/filters/${id}`,
      {},
      undefined,
      "DELETE",
    );
  }

  /** Deletes a user label (its messages lose it; none are deleted). */
  async deleteLabel(id: string): Promise<void> {
    await this.send<unknown>(`/labels/${id}`, {}, undefined, "DELETE");
  }

  profile(): Promise<GmailProfile> {
    return this.send<GmailProfile>("/profile");
  }

  async labels(): Promise<GmailLabelInfo[]> {
    const body = await this.send<{
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
    const body = await this.send<{
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
   * and matching Gmail's search `query` when one is given; Trash and Spam
   * left out as Gmail leaves them out.
   */
  async messageIds(labelId?: string, query?: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const body = await this.send<{
        messages?: { id: string }[];
        nextPageToken?: string;
      }>("/messages", {
        maxResults: 500,
        ...(labelId ? { labelIds: labelId } : {}),
        ...(query ? { q: query } : {}),
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
      const body = await this.send<{
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
    return this.send<{ id: string; labelIds?: string[] }>(`/messages/${id}`, {
      format: "minimal",
    });
  }

  /** A message's RFC 822 text and Gmail's facts about it. */
  raw(id: string): Promise<GmailRawMessage> {
    return this.send<GmailRawMessage>(`/messages/${id}`, { format: "raw" });
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
      body?: unknown,
      method?: "PATCH" | "DELETE",
    ) =>
      (
        await client.request<T>({
          url,
          params,
          method: method ?? (body === undefined ? "GET" : "POST"),
          ...(body === undefined ? {} : { data: body }),
        })
      ).data;
    return new GmailMailbox(transport, intervalMs);
  }
}
