import { randomUUID } from "crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CalendarProviderRegistry } from "../../providers/services/CalendarProviderRegistry";
import { SyncConfigService } from "../../sync/services/SyncConfigService";
import { SyncedCalendarConfig } from "../../sync/syncedCalendarConfig";
import {
  CalendarAuthStrategy,
  LoopbackFlow,
} from "../strategies/calendarAuthStrategy";
import { GoogleAuthStrategy } from "../strategies/GoogleAuthStrategy";
import { MicrosoftAuthStrategy } from "../strategies/MicrosoftAuthStrategy";
import { AvailableCalendarDto } from "../dto/AvailableCalendarDto";
import { CalendarAccountStatusDto } from "../dto/CalendarAccountStatusDto";
import { NewAccountAuthStatusDto } from "../dto/NewAccountAuthStatusDto";

const REAUTH_TIMEOUT_MS = 5 * 60 * 1000;
const NEW_ACCOUNT_AUTH_TIMEOUT_MS = 5 * 60 * 1000;

type CalendarProviderName = "google" | "microsoft";

type ReauthEntry =
  | { phase: "pending"; authUrl: string }
  | { phase: "failed"; authUrl: string; error: string };

type NewAccountAuthEntry =
  | { phase: "pending" }
  | { phase: "success"; accountLabel: string }
  | { phase: "failed"; error: string };

/**
 * Status and re-authorization for the device-flow-style credentials calendar
 * sync runs on (see the per-provider credential stores) — distinct from the
 * browser OIDC login the web app itself uses (see ../auth). Provider-specific
 * behavior lives entirely in the strategies (see ./strategies); this service
 * only resolves which strategy owns a given accountLabel and orchestrates
 * the in-flight reauth/new-account bookkeeping shared by both.
 *
 * accountLabel is *not* globally unique on its own — the same label
 * (typically an email address) can be a connected account under more than
 * one provider at once (e.g. the same address as both a Google Workspace
 * and a Microsoft 365 identity). Every per-account lookup below therefore
 * takes an explicit `provider` wherever the caller can supply one; it's only
 * left optional where a caller genuinely doesn't know it yet, in which case
 * resolution falls back to a best-effort (and, in a collision, ambiguous)
 * guess.
 */
@Injectable()
export class CalendarAuthService {
  private readonly logger = new Logger(CalendarAuthService.name);
  private readonly strategies: Record<
    CalendarProviderName,
    CalendarAuthStrategy
  > = {
    google: new GoogleAuthStrategy(),
    microsoft: new MicrosoftAuthStrategy(),
  };
  /** In-flight or most-recently-failed reauth attempts, keyed by "provider\0accountLabel". Cleared on success. */
  private readonly reauth = new Map<string, ReauthEntry>();
  /** In-flight or resolved new-account authorizations, keyed by a random transactionId — there's no accountLabel to key by until the flow tells us the signed-in email. */
  private readonly newAccountAuth = new Map<string, NewAccountAuthEntry>();

  constructor(
    private readonly config: SyncConfigService,
    private readonly providers: CalendarProviderRegistry,
  ) {}

  async listStatuses(): Promise<CalendarAccountStatusDto[]> {
    const entries = await this.allAccountEntries();
    return Promise.all(
      entries.map(({ accountLabel, provider }) =>
        this.buildStatus(accountLabel, this.strategies[provider]),
      ),
    );
  }

  /** Whether `accountLabel` has a stored, usable credential for `provider` — CalendarsController checks this before adding a calendar for it. */
  isConnected(accountLabel: string, provider: CalendarProviderName): boolean {
    return (
      this.strategies[provider].tryLoadCredential(accountLabel) !== undefined
    );
  }

  async getStatus(
    accountLabel: string,
    provider?: CalendarProviderName,
  ): Promise<CalendarAccountStatusDto> {
    const strategy = await this.resolveStrategy(accountLabel, provider);
    return this.buildStatus(accountLabel, strategy);
  }

  private async buildStatus(
    accountLabel: string,
    strategy: CalendarAuthStrategy,
  ): Promise<CalendarAccountStatusDto> {
    const sources = await this.sourcesFor(accountLabel, strategy.provider);
    const entry = this.reauth.get(reauthKey(strategy.provider, accountLabel));
    if (entry?.phase === "pending") {
      return {
        accountLabel,
        provider: strategy.provider,
        sources,
        status: "reauth_pending",
      };
    }

    const credential = strategy.tryLoadCredential(accountLabel);
    if (!credential) {
      return entry?.phase === "failed"
        ? {
            accountLabel,
            provider: strategy.provider,
            sources,
            status: "error",
            error: entry.error,
          }
        : {
            accountLabel,
            provider: strategy.provider,
            sources,
            status: "not_connected",
          };
    }

    const base = {
      accountLabel,
      provider: strategy.provider,
      sources,
      scope: credential.scope,
      obtainedAt: credential.obtainedAt,
    };
    if (entry?.phase === "failed") {
      return { ...base, status: "error", error: entry.error };
    }

    try {
      const { expiresAt } = await strategy.checkAccessToken(accountLabel);
      return { ...base, status: "ok", accessTokenExpiresAt: expiresAt };
    } catch (error) {
      const message = strategy.errorMessage(error);
      this.logger.warn(
        `${strategy.provider} credential check failed for "${accountLabel}": ${message}`,
      );
      return {
        ...base,
        status: strategy.isInvalidGrantError(error) ? "expired" : "error",
        error: message,
      };
    }
  }

  /**
   * Starts a fresh OAuth consent flow for `accountLabel`, the same loopback
   * mechanism as the CLI setup scripts but driven from the API so the Sync
   * page can open it in a new tab. Returns immediately with the URL to open;
   * the exchange completes in the background once the user finishes
   * granting access.
   */
  async startReauth(
    accountLabel: string,
    provider?: CalendarProviderName,
  ): Promise<{ authUrl: string }> {
    const strategy = await this.resolveStrategy(accountLabel, provider);
    const key = reauthKey(strategy.provider, accountLabel);

    const existing = this.reauth.get(key);
    if (existing?.phase === "pending") {
      return { authUrl: existing.authUrl };
    }

    const flow = await strategy.startLoopbackFlow({
      mode: "reauth",
      accountLabel,
    });
    this.reauth.set(key, { phase: "pending", authUrl: flow.authUrl });
    this.completeReauth(key, accountLabel, flow);

    return { authUrl: flow.authUrl };
  }

  private async completeReauth(
    key: string,
    accountLabel: string,
    flow: LoopbackFlow,
  ): Promise<void> {
    try {
      await flow.complete(REAUTH_TIMEOUT_MS);
      this.reauth.delete(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Reauth failed for "${accountLabel}": ${message}`);
      this.reauth.set(key, {
        phase: "failed",
        authUrl: flow.authUrl,
        error: message,
      });
    }
  }

  /**
   * Every calendar the account's provider reports, flagged with whether it's
   * already configured to sync — for the Sync page's discovery UI. Requires
   * a stored credential (i.e. the account has completed login at least
   * once); a never-connected account has nothing to discover from.
   */
  async listAvailableCalendars(
    accountLabel: string,
    provider?: CalendarProviderName,
  ): Promise<AvailableCalendarDto[]> {
    const strategy = await this.resolveStrategy(accountLabel, provider);
    if (!strategy.tryLoadCredential(accountLabel)) {
      throw new NotFoundException(
        `Account "${accountLabel}" hasn't completed sign-in yet`,
      );
    }

    const synced = new Set(
      (await this.calendarsFor(accountLabel, strategy.provider)).map(
        (c) => c.calendarId,
      ),
    );
    const calendars = await this.providers
      .forAccount(accountLabel, strategy.provider)
      .listCalendars();
    return calendars.map((calendar) => ({
      id: calendar.id,
      summary: calendar.summary,
      // The provider reports the primary calendar under its real id (e.g.
      // the account email for Google), not the "primary" alias
      // SyncedCalendarConfig accepts as a shorthand for it — check both so
      // an already-synced primary calendar isn't shown as addable under its
      // other name (which would double-sync it).
      alreadySynced:
        synced.has(calendar.id) ||
        Boolean(calendar.primary && synced.has("primary")),
    }));
  }

  /**
   * Starts authorizing a brand-new account for `provider` — unlike
   * startReauth, there's no existing accountLabel to key this by, so callers
   * poll getNewAccountAuthStatus with the returned transactionId instead.
   * Once it succeeds, the account (with zero calendars so far) shows up in
   * listStatuses via each strategy's listStoredAccountLabels, ready for the
   * Sync page's discovery UI to add its first calendar.
   */
  async startNewAccountAuth(
    provider: CalendarProviderName,
  ): Promise<{ transactionId: string; authUrl: string }> {
    const flow = await this.strategies[provider].startLoopbackFlow({
      mode: "new",
    });

    const transactionId = randomUUID();
    this.newAccountAuth.set(transactionId, { phase: "pending" });
    this.completeNewAccountAuth(transactionId, flow);

    return { transactionId, authUrl: flow.authUrl };
  }

  getNewAccountAuthStatus(transactionId: string): NewAccountAuthStatusDto {
    const entry = this.newAccountAuth.get(transactionId);
    if (!entry) {
      throw new NotFoundException(
        `No new-account authorization "${transactionId}"`,
      );
    }
    return entry.phase === "pending"
      ? { status: "pending" }
      : entry.phase === "success"
        ? { status: "success", accountLabel: entry.accountLabel }
        : { status: "error", error: entry.error };
  }

  private async completeNewAccountAuth(
    transactionId: string,
    flow: LoopbackFlow,
  ): Promise<void> {
    try {
      const { accountLabel } = await flow.complete(NEW_ACCOUNT_AUTH_TIMEOUT_MS);
      this.newAccountAuth.set(transactionId, {
        phase: "success",
        accountLabel,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `New account authorization "${transactionId}" failed: ${message}`,
      );
      this.newAccountAuth.set(transactionId, {
        phase: "failed",
        error: message,
      });
    }
  }

  /**
   * Resolves which strategy owns `accountLabel`. With an explicit
   * `provider`, this just confirms the account is actually known under it
   * (configured, or a stored credential) — unambiguous even when the same
   * label exists under another provider too. Without one, it falls back to
   * a best-effort guess (a configured calendar's own provider, else
   * whichever strategy's credential store has a matching stored account) —
   * ambiguous if the same label happens to be connected under more than one
   * provider, but there's no third option for callers that don't know it.
   */
  private async resolveStrategy(
    accountLabel: string,
    provider?: CalendarProviderName,
  ): Promise<CalendarAuthStrategy> {
    if (provider) {
      const strategy = this.strategies[provider];
      const configured = (await this.config.getAll()).some(
        (c) => c.accountLabel === accountLabel && c.provider === provider,
      );
      if (
        !configured &&
        !strategy.listStoredAccountLabels().includes(accountLabel)
      ) {
        throw new NotFoundException(
          `No configured calendar uses ${provider} account "${accountLabel}"`,
        );
      }
      return strategy;
    }

    const configured = (await this.config.getAll()).find(
      (c) => c.accountLabel === accountLabel,
    );
    if (configured) {
      return this.strategies[configured.provider as CalendarProviderName];
    }
    for (const strategy of Object.values(this.strategies)) {
      if (strategy.listStoredAccountLabels().includes(accountLabel)) {
        return strategy;
      }
    }
    throw new NotFoundException(
      `No configured calendar uses account "${accountLabel}"`,
    );
  }

  private async allAccountEntries(): Promise<
    { accountLabel: string; provider: CalendarProviderName }[]
  > {
    // Keyed by "provider\0accountLabel" — accountLabel alone isn't unique
    // across providers (see class doc comment).
    const entries = new Map<
      string,
      { accountLabel: string; provider: CalendarProviderName }
    >();
    for (const calendar of await this.config.getAll()) {
      const provider = calendar.provider as CalendarProviderName;
      entries.set(reauthKey(provider, calendar.accountLabel), {
        accountLabel: calendar.accountLabel,
        provider,
      });
    }
    // Includes accounts with a stored credential but no calendar yet — a
    // freshly authorized account needs to appear so its first calendar can
    // be added, before it has any SyncedCalendarConfig entry at all.
    for (const strategy of Object.values(this.strategies)) {
      for (const accountLabel of strategy.listStoredAccountLabels()) {
        const key = reauthKey(strategy.provider, accountLabel);
        if (!entries.has(key))
          entries.set(key, { accountLabel, provider: strategy.provider });
      }
    }
    return [...entries.values()];
  }

  private async calendarsFor(
    accountLabel: string,
    provider: CalendarProviderName,
  ): Promise<SyncedCalendarConfig[]> {
    return (await this.config.getAll()).filter(
      (c) => c.accountLabel === accountLabel && c.provider === provider,
    );
  }

  private async sourcesFor(
    accountLabel: string,
    provider: CalendarProviderName,
  ): Promise<string[]> {
    return (await this.calendarsFor(accountLabel, provider)).map(
      (c) => c.source,
    );
  }
}

function reauthKey(
  provider: CalendarProviderName,
  accountLabel: string,
): string {
  return `${provider}\0${accountLabel}`;
}
