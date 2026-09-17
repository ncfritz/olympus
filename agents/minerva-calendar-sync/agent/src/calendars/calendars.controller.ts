import { Body, Controller, Delete, Get, HttpCode, Inject, Logger, NotFoundException, Param, Post, Put } from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CALENDAR_BUSY_INCLUSION_STORE, CalendarBusyInclusionStore } from "../store/calendar-busy-inclusion-store";
import { CALENDAR_ENABLEMENT_STORE, CalendarEnablementStore } from "../store/calendar-enablement-store";
import { EVENT_STORE, EventStore } from "../store/event-store";
import { SyncConfigService } from "../sync/sync-config.service";
import { SyncEngine } from "../sync/sync-engine";
import { SyncedCalendarConfig } from "../sync/synced-calendar-config";
import { AddCalendarDto } from "./dto/add-calendar.dto";
import { CalendarStatusDto } from "./dto/calendar-status.dto";
import { SetCalendarBusyInclusionDto } from "./dto/set-calendar-busy-inclusion.dto";
import { SetCalendarEnabledDto } from "./dto/set-calendar-enabled.dto";

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
    private readonly engine: SyncEngine,
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
          removable: this.config.isRemovable(calendar.calendarId),
          syncing: this.engine.isSyncing(calendar.calendarId),
        };
      }),
    );
  }

  @Post()
  @ApiCreatedResponse({ type: CalendarStatusDto, description: "The newly added calendar — an initial sync is kicked off in the background" })
  @ApiConflictResponse({ description: "This calendar is already being synced" })
  @ApiNotFoundResponse({ description: "No configured calendar uses that account yet" })
  async add(@Body() body: AddCalendarDto): Promise<CalendarStatusDto> {
    const calendar: SyncedCalendarConfig = {
      provider: "google",
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
      removable: true,
      syncing: this.engine.isSyncing(calendar.calendarId),
    };
  }

  @Delete(":calendarId")
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "No configured calendar with that id" })
  @ApiForbiddenResponse({ description: "This calendar is configured via SYNCED_CALENDARS and can't be removed here" })
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

  private async assertConfigured(calendarId: string): Promise<SyncedCalendarConfig> {
    const calendar = (await this.config.getAll()).find((c) => c.calendarId === calendarId);
    if (!calendar) {
      throw new NotFoundException(`No configured calendar "${calendarId}"`);
    }
    return calendar;
  }
}
