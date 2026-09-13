import { Controller, Get, HttpCode, Inject, Logger, NotFoundException, Param, Post } from "@nestjs/common";
import { ApiAcceptedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { EVENT_STORE, EventStore } from "../store/event-store";
import { SyncConfigService } from "../sync/sync-config.service";
import { SyncEngine } from "../sync/sync-engine";
import { CalendarStatusDto } from "./dto/calendar-status.dto";

@ApiTags("calendars")
@Controller("calendars")
export class CalendarsController {
  private readonly logger = new Logger(CalendarsController.name);

  constructor(
    private readonly config: SyncConfigService,
    @Inject(EVENT_STORE) private readonly store: EventStore,
    private readonly engine: SyncEngine,
  ) {}

  @Get()
  @ApiOkResponse({ type: CalendarStatusDto, isArray: true })
  async list(): Promise<CalendarStatusDto[]> {
    return Promise.all(
      this.config.getAll().map(async (calendar) => {
        const state = await this.store.getSyncState(calendar.calendarId);
        return { ...calendar, synced: Boolean(state?.syncToken) };
      }),
    );
  }

  @Post(":calendarId/sync")
  @HttpCode(202)
  @ApiAcceptedResponse({ description: "Sync triggered — runs in the background" })
  @ApiNotFoundResponse({ description: "No configured calendar with that id" })
  triggerSync(@Param("calendarId") calendarId: string): void {
    const calendar = this.config.getAll().find((c) => c.calendarId === calendarId);
    if (!calendar) {
      throw new NotFoundException(`No configured calendar "${calendarId}"`);
    }

    // Fire-and-forget: the caller gets 202 immediately rather than waiting
    // out a potentially slow full/incremental sync.
    this.engine.syncOne(calendar).catch((error) => {
      this.logger.error(
        `Manually triggered sync failed for "${calendarId}": ${error instanceof Error ? error.message : error}`,
      );
    });
  }
}
