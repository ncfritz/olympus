import {
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { buildCanonicalEventId } from "../../domain/canonicalEvent";
import { OutboxSourceStats } from "../../domain/outbox";
import {
  OUTBOX_ENABLED,
  OUTBOX_STORE,
  OutboxStore,
} from "../../store/outboxStore";
import { SyncConfigService } from "../../sync/services/SyncConfigService";
import { EventPublishStatusDto } from "../dto/EventPublishStatusDto";
import { ListFailedQueryDto } from "../dto/ListFailedQueryDto";
import { OutboxRecordDto } from "../dto/OutboxRecordDto";
import { OutboxSummaryDto } from "../dto/OutboxSummaryDto";

const DEFAULT_FAILED_LIMIT = 50;

@ApiBearerAuth()
@ApiTags("outbox")
@Controller("outbox")
export class OutboxController {
  constructor(
    @Inject(OUTBOX_STORE) private readonly outbox: OutboxStore,
    @Inject(OUTBOX_ENABLED) private readonly outboxEnabled: boolean,
    private readonly syncConfig: SyncConfigService,
  ) {}

  /**
   * Backs the Publish page's per-calendar summary table. Every *configured*
   * calendar gets a row, zero-filled if it has no outbox activity yet —
   * otherwise a calendar that's never been published (exactly the case
   * backfill exists for) would have no row to trigger it from. A source
   * with outbox activity but no matching configured calendar (removed from
   * sync after publishing something) still gets a row too, just without a
   * calendarId to backfill — dropping it would hide a stuck failure just
   * because its calendar is gone.
   */
  @Get("summary")
  @ApiOkResponse({ type: OutboxSummaryDto })
  async summary(): Promise<OutboxSummaryDto> {
    const [stats, calendars] = await Promise.all([
      this.outbox.getStats(),
      this.syncConfig.getAll(),
    ]);
    const calendarIdBySource = new Map(
      calendars.map((c) => [c.source, c.calendarId]),
    );
    const zeroStats = { pending: 0, sent: 0, failed: 0, oldestPendingAt: null };

    const sources = new Map<
      string,
      OutboxSourceStats & { calendarId: string | null }
    >(
      calendars.map((c) => [
        c.source,
        { ...zeroStats, source: c.source, calendarId: c.calendarId },
      ]),
    );
    for (const s of stats) {
      sources.set(s.source, {
        ...s,
        calendarId: calendarIdBySource.get(s.source) ?? null,
      });
    }

    return { enabled: this.outboxEnabled, sources: [...sources.values()] };
  }

  /** Backs the Publish page's failed-rows table — registered ahead of ":source/:uid"-shaped routes isn't a concern here since this segment ("failed") never collides with a source label used as a path param elsewhere. */
  @Get("failed")
  @ApiOkResponse({ type: OutboxRecordDto, isArray: true })
  listFailed(@Query() query: ListFailedQueryDto): Promise<OutboxRecordDto[]> {
    return this.outbox.listFailed(query.limit ?? DEFAULT_FAILED_LIMIT);
  }

  @Post("failed/:id/requeue")
  @HttpCode(204)
  @ApiNoContentResponse({
    description: "Requeued — the dispatcher will retry it on its next tick",
  })
  @ApiNotFoundResponse({ description: "No failed outbox row with that id" })
  async requeue(@Param("id") id: string): Promise<void> {
    const requeued = await this.outbox.requeue(id);
    if (!requeued) {
      throw new NotFoundException(`No failed outbox row "${id}"`);
    }
  }

  /** Backs the "Publish status" row in the event detail drawer. */
  @Get("events/:source/:uid")
  @ApiOkResponse({ type: EventPublishStatusDto })
  async eventStatus(
    @Param("source") source: string,
    @Param("uid") uid: string,
  ): Promise<EventPublishStatusDto> {
    const latest = await this.outbox.getLatestForEvent(
      buildCanonicalEventId(source, uid),
    );
    return { enabled: this.outboxEnabled, latest };
  }
}
