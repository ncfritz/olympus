import { randomBytes } from "crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { PushChannel } from "../providers/calendar-provider";
import { CalendarProviderRegistry } from "../providers/calendar-provider-registry";
import { EVENT_STORE, EventStore } from "../store/event-store";
import { ChangeNotifier } from "./change-notifier";
import { SyncConfigService } from "./sync-config.service";
import { SyncedCalendarConfig } from "./synced-calendar-config";

const RENEWAL_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RENEWAL_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const RENEWAL_TIMER_NAME = "webhook-channel-renewal";

interface ChannelRegistration {
  token: string;
}

/**
 * Provider push notifications (Google channels, Microsoft Graph
 * subscriptions) only ever carry a channel/subscription id — never the
 * actual change — so, like PollingNotifier, this only ever signals
 * "something may have changed" for SyncEngine to handle. Each provider gets
 * its own receiving endpoint at `/webhooks/{provider.id}` (see
 * WebhooksController, MicrosoftWebhooksController), both funneling into
 * `handleNotification` below.
 *
 * Requires WEBHOOK_BASE_URL to be a real, publicly reachable HTTPS endpoint
 * (neither provider will deliver to plain HTTP or to localhost); if it's
 * missing, this is a no-op and polling alone still covers every calendar
 * per ChangeNotifier's contract.
 */
@Injectable()
export class WebhookNotifier implements ChangeNotifier {
  private readonly logger = new Logger(WebhookNotifier.name);
  private readonly webhookBaseUrl?: string;
  private readonly channelsByCalendarId = new Map<
    string,
    ChannelRegistration
  >();
  private readonly calendarIdByChannelId = new Map<string, string>();
  private onChange?: (calendarId: string, trigger: "webhook") => void;
  private startupPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly syncConfig: SyncConfigService,
    private readonly providers: CalendarProviderRegistry,
    @Inject(EVENT_STORE) private readonly store: EventStore,
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService,
  ) {
    this.webhookBaseUrl = config.get<string>("WEBHOOK_BASE_URL");
  }

  start(onChange: (calendarId: string, trigger: "webhook") => void): void {
    this.onChange = onChange;
    this.startupPromise = this.setUp();
  }

  private async setUp(): Promise<void> {
    const pushCalendars = (await this.syncConfig.getAll()).filter(
      (c) => c.enablePush,
    );
    if (pushCalendars.length === 0) return;

    if (!this.webhookBaseUrl?.startsWith("https://")) {
      this.logger.warn(
        "One or more calendars have enablePush set, but WEBHOOK_BASE_URL is missing or not HTTPS " +
          "— push notifications disabled; polling still covers them",
      );
      return;
    }

    await this.registerAll(pushCalendars);

    const timer = setInterval(
      () => this.renewExpiringChannels(pushCalendars),
      RENEWAL_CHECK_INTERVAL_MS,
    );
    this.scheduler.addInterval(RENEWAL_TIMER_NAME, timer);
  }

  stop(): void {
    if (this.scheduler.doesExist("interval", RENEWAL_TIMER_NAME)) {
      this.scheduler.deleteInterval(RENEWAL_TIMER_NAME);
    }
  }

  /**
   * Resolves once the initial round of channel registration (triggered by
   * `start`) has settled. `start` itself stays synchronous to satisfy
   * ChangeNotifier — this is for callers (health checks, tests) that need
   * to know registration has actually finished rather than just been kicked off.
   */
  async waitUntilReady(): Promise<void> {
    await this.startupPromise;
  }

  private async registerAll(calendars: SyncedCalendarConfig[]): Promise<void> {
    // Sequential on purpose: SQLite tolerates concurrent writers poorly,
    // and there's no real urgency across a handful of calendars.
    for (const calendar of calendars) {
      try {
        await this.registerChannel(calendar);
      } catch (error) {
        this.logger.error(
          `Failed to register a push channel for "${calendar.calendarId}": ${message(error)}`,
        );
      }
    }
  }

  /** Called by WebhooksController/MicrosoftWebhooksController for every incoming push notification. */
  handleNotification(channelId: string, token: string | undefined): void {
    const calendarId = this.calendarIdByChannelId.get(channelId);
    if (!calendarId) {
      this.logger.debug(
        `Ignoring a notification for unknown channel "${channelId}"`,
      );
      return;
    }

    const registration = this.channelsByCalendarId.get(calendarId);
    if (registration?.token !== token) {
      this.logger.warn(
        `Ignoring a notification for "${calendarId}" — channel token mismatch`,
      );
      return;
    }

    this.onChange?.(calendarId, "webhook");
  }

  private async registerChannel(calendar: SyncedCalendarConfig): Promise<void> {
    const provider = this.providers.resolve(calendar);
    if (!provider.supportsPush() || !provider.watch) {
      this.logger.warn(
        `Provider "${provider.id}" doesn't support push — "${calendar.calendarId}" stays poll-only`,
      );
      return;
    }

    const token = randomBytes(24).toString("hex");
    const webhookUrl = `${this.webhookBaseUrl}/webhooks/${provider.id}`;
    const channel = await provider.watch(
      calendar.calendarId,
      webhookUrl,
      token,
    );

    this.channelsByCalendarId.set(calendar.calendarId, { token });
    this.calendarIdByChannelId.set(channel.id, calendar.calendarId);

    const existing = await this.store.getSyncState(calendar.calendarId);
    await this.store.saveSyncState(calendar.calendarId, {
      calendarId: calendar.calendarId,
      syncToken: existing?.syncToken ?? null,
      channelId: channel.id,
      resourceId: channel.resourceId,
      channelExpiration: channel.expiration,
      channelToken: token,
      lastFullSyncAt: existing?.lastFullSyncAt ?? null,
    });

    this.logger.log(
      `Registered a push channel for "${calendar.calendarId}", expiring ${channel.expiration}`,
    );
  }

  private async renewExpiringChannels(
    calendars: SyncedCalendarConfig[],
  ): Promise<void> {
    for (const calendar of calendars) {
      try {
        await this.renewIfExpiring(calendar);
      } catch (error) {
        this.logger.error(
          `Failed to renew the push channel for "${calendar.calendarId}": ${message(error)}`,
        );
      }
    }
  }

  private async renewIfExpiring(calendar: SyncedCalendarConfig): Promise<void> {
    const state = await this.store.getSyncState(calendar.calendarId);
    if (!state?.channelExpiration) return;

    const msUntilExpiry = Date.parse(state.channelExpiration) - Date.now();
    if (msUntilExpiry > RENEWAL_THRESHOLD_MS) return;

    this.logger.log(
      `Renewing the push channel for "${calendar.calendarId}" (expires ${state.channelExpiration})`,
    );

    const oldChannel: PushChannel | null =
      state.channelId && state.resourceId
        ? {
            id: state.channelId,
            resourceId: state.resourceId,
            expiration: state.channelExpiration,
          }
        : null;

    await this.registerChannel(calendar);

    if (oldChannel) {
      this.calendarIdByChannelId.delete(oldChannel.id);
      const provider = this.providers.resolve(calendar);
      if (provider.stopWatch) {
        await provider
          .stopWatch(oldChannel)
          .catch((error) =>
            this.logger.warn(
              `Failed to stop the old push channel for "${calendar.calendarId}": ${message(error)}`,
            ),
          );
      }
    }
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
