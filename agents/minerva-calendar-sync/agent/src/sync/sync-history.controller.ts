import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { SYNC_RUN_STORE, SyncRunStore } from "../store/sync-run-store";
import { ListSyncRunsQueryDto } from "./dto/list-sync-runs-query.dto";
import {
  SyncRunDailyStatDto,
  SyncRunDetailDto,
  SyncRunDto,
} from "./dto/sync-run.dto";
import { SyncRunStatsQueryDto } from "./dto/sync-run-stats-query.dto";

const DEFAULT_STATS_WINDOW_DAYS = 30;

@ApiBearerAuth()
@ApiTags("sync-runs")
@Controller("sync-runs")
export class SyncHistoryController {
  constructor(
    @Inject(SYNC_RUN_STORE) private readonly syncRuns: SyncRunStore,
  ) {}

  @Get()
  @ApiOkResponse({ type: SyncRunDto, isArray: true })
  list(@Query() query: ListSyncRunsQueryDto): Promise<SyncRunDto[]> {
    return this.syncRuns.list(query);
  }

  /**
   * Backs the Sync page's charts — one row per (day, calendar) over a
   * trailing window, respecting the same filters as the list above.
   * Registered ahead of ":id" below so "stats" isn't swallowed as an id.
   */
  @Get("stats")
  @ApiOkResponse({ type: SyncRunDailyStatDto, isArray: true })
  dailyStats(
    @Query() query: SyncRunStatsQueryDto,
  ): Promise<SyncRunDailyStatDto[]> {
    const days = query.days ?? DEFAULT_STATS_WINDOW_DAYS;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    since.setUTCHours(0, 0, 0, 0);

    return this.syncRuns.dailyStats({ ...query, since: since.toISOString() });
  }

  @Get(":id")
  @ApiOkResponse({ type: SyncRunDetailDto })
  @ApiNotFoundResponse({ description: "No sync run with that id" })
  async getOne(@Param("id") id: string): Promise<SyncRunDetailDto> {
    const run = await this.syncRuns.get(id);
    if (!run) {
      throw new NotFoundException(`No sync run "${id}"`);
    }
    return run;
  }
}
