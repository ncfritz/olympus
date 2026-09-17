import { Body, ConflictException, Controller, Delete, Get, HttpCode, Inject, Logger, NotFoundException, Param, Post, Put } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CalendarAuthService } from "../calendar-auth/calendar-auth.service";
import { CanonicalCalendarEvent } from "../domain/canonical-event";
import { CALENDAR_BUSY_INCLUSION_STORE, CalendarBusyInclusionStore } from "../store/calendar-busy-inclusion-store";
import { CALENDAR_ENABLEMENT_STORE, CalendarEnablementStore } from "../store/calendar-enablement-store";
import { EVENT_STORE, EventStore } from "../store/event-store";
import { OUTBOX_ENABLED, OUTBOX_STORE, OutboxStore } from "../store/outbox-store";
import { SyncConfigService } from "../sync/sync-config.service";
import { SyncEngine } from "../sync/sync-engine";
import { SyncedCalendarConfig } from "../sync/synced-calendar-config";
import { AddCalendarDto } from "./dto/add-calendar.dto";
import { BackfillResultDto } from "./dto/backfill-result.dto";
import { CalendarStatusDto } from "./dto/calendar-status.dto";
import { SetCalendarBusyInclusionDto } from "./dto/set-calendar-busy-inclusion.dto";
import { SetCalendarEnabledDto } from "./dto/set-calendar-enabled.dto";

// Pragmatic cap on one backfill request, same reasoning (and same order of
// magnitude) as SyncEngine's FULL_SYNC_DIFF_LIMIT: fine for a personal/
// small-team calendar, would need real pagination well beyond this scale.
const BACKFILL_LIMIT = 10_000;
const BACKFILL_PAGE_SIZE = 500;

@ApiBearerAuth()
@ApiTags("calendars")
@Controller("calendars")
export class CalendarsController {
  private readonly logger = new Logger(CalendarsController.name);

  constructor(
    private readonly config: SyncConfigService,
    @Inject(EVENT_STORE) private readonly store: EventStore,
    @Inject(CALENDAR_ENABLEMENT_STORE) private readonly enablement: CalendarEnablementStore,
    @Inject(CALENDAR_BUSY_INCLUSION_STORE) private readonly busyInclusion: CalendarBusyInclusionStore,
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    @Inject(OUTBOX_ENABLED) private readonly outboxEnabled: boolean,
    private readonly engine: SyncEngine,
    private readonly calendarAuth: CalendarAuthService,
  ) {}

  @Get()
  @ApiOkResponse({ type: CalendarStatusDto, isArray: true })
  async list(): Promise<CalendarStatusDto[]> {
    const [calendars, enabledOverrides, busyOverrides] = await Promise.all([
      this.config.getAll(),
      this.enablement.listOverrides(),
      this.busyInclusion.listOverrides(),
    ]);
    return Promise.all(
      calendars.map(async (calendar) => {
        const state = await this.store.getSyncState(calendar.calendarId);
        return {
          ...calendar,
          synced: Boolean(state?.syncToken),
          enabled: enabledOverrides[calendar.calendarId] ?? true,
          includedInBusy: busyOverrides[calendar.calendarId] ?? true,
          lastSyncedAt: state?.lastSyncedAt,
          syncing: this.engine.isSyncing(calendar.calendarId),
        };
      }),
    );
  }

  @Post()
  @ApiCreatedResponse({ type: CalendarStatusDto, description: "The newly added calendar — an initial sync is kicked off in the background" })
  @ApiConflictResponse({ description: "This calendar is already being synced" })
  @ApiNotFoundResponse({ description: "That account isn't connected yet" })
  async add(@Body() body: AddCalendarDto): Promise<CalendarStatusDto> {
    if (!this.calendarAuth.isConnected(body.accountLabel, body.provider)) {
      throw new NotFoundException(`Account "${body.accountLabel}" (${body.provider}) isn't connected yet`);
    }

    const calendar: SyncedCalendarConfig = {
      provider: body.provider,
      accountLabel: body.accountLabel,
      calendarId: body.calendarId,
      source: body.source,
      enablePush: false,
    };
    await this.config.add(calendar);

    // Fire-and-forget: don't make the caller wait out a potentially slow
    // full sync just to see the calendar appear.
    this.engine.syncOne(calendar, "manual").catch((error) => {
      this.logger.error(
        `Initial sync failed for newly added calendar "${calendar.calendarId}": ${error instanceof Error ? error.message : error}`,
      );
    });

    return {
      ...calendar,
      synced: false,
      enabled: true,
      includedInBusy: true,
      syncing: this.engine.isSyncing(calendar.calendarId),
    };
  }

  @Delete(":calendarId")
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "No configured calendar with that id" })
  async remove(@Param("calendarId") calendarId: string): Promise<void> {
    await this.config.remove(calendarId);
  }

  @Put(":calendarId/enabled")
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "No configured calendar with that id" })
  async setEnabled(@Param("calendarId") calendarId: string, @Body() body: SetCalendarEnabledDto): Promise<void> {
    await this.assertConfigured(calendarId);
    await this.enablement.setEnabled(calendarId, body.enabled);
  }

  @Put(":calendarId/included-in-busy")
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "No configured calendar with that id" })
  async setIncludedInBusy(
    @Param("calendarId") calendarId: string,
    @Body() body: SetCalendarBusyInclusionDto,
  ): Promise<void> {
    await this.assertConfigured(calendarId);
    await this.busyInclusion.setIncludedInBusy(calendarId, body.includedInBusy);
  }

  @Post(":calendarId/sync")
  @HttpCode(202)
  @ApiAcceptedResponse({ description: "Sync triggered — runs in the background" })
  @ApiNotFoundResponse({ description: "No configured calendar with that id" })
  async triggerSync(@Param("calendarId") calendarId: string): Promise<void> {
    const calendar = await this.assertConfigured(calendarId);

    // Fire-and-forget: the caller gets 202 immediately rather than waiting
    // out a potentially slow full/incremental sync.
    this.engine.syncOne(calendar, "manual").catch((error) => {
      this.logger.error(
        `Manually triggered sync failed for "${calendarId}": ${error instanceof Error ? error.message : error}`,
      );
    });
  }

  /**
   * Re-queues this calendar's current, non-deleted events onto the outbound
   * broker as a "backfill" resend — for standing up a fresh downstream
   * database, or recovering one that fell too far behind for its own
   * retries to catch up. Synchronous rather than fire-and-forget like
   * triggerSync: enqueuing is a handful of bulk inserts, not a slow
   * round trip to a calendar provider, so the caller can just wait for the
   * count.
   */
  @Post(":calendarId/backfill")
  @ApiOkResponse({ type: BackfillResultDto })
  @ApiNotFoundResponse({ description: "No configured calendar with that id" })
  @ApiConflictResponse({ description: "Outbound sync isn't configured (RABBITMQ_URL unset)" })
  async backfill(@Param("calendarId") calendarId: string): Promise<BackfillResultDto> {
    const calendar = await this.assertConfigured(calendarId);
    if (!this.outboxEnabled) {
      throw new ConflictException("Outbound sync isn't configured — set RABBITMQ_URL to enable it");
    }

    let cursor: string | undefined;
    let enqueued = 0;

    while (enqueued < BACKFILL_LIMIT) {
      const page: CanonicalCalendarEvent[] = await this.store.listEvents({
        source: calendar.source,
        deleted: false,
        limit: BACKFILL_PAGE_SIZE,
        cursor,
      });
      if (page.length === 0) break;

      enqueued += await this.outbox.enqueueBackfill(calendar.source, page);
      cursor = page[page.length - 1].id;
      if (page.length < BACKFILL_PAGE_SIZE) break;
    }

    return { enqueued, truncated: enqueued >= BACKFILL_LIMIT };
  }

  private async assertConfigured(calendarId: string): Promise<SyncedCalendarConfig> {
    const calendar = (await this.config.getAll()).find((c) => c.calendarId === calendarId);
    if (!calendar) {
      throw new NotFoundException(`No configured calendar "${calendarId}"`);
    }
    return calendar;
  }
}
