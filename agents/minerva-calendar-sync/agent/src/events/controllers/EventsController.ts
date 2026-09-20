import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  EVENT_OVERRIDE_STORE,
  EventOverrideStore,
} from "../../store/eventOverrideStore";
import { EVENT_STORE, EventStore } from "../../store/eventStore";
import { EventOverrideResponseDto } from "../dto/EventOverrideResponseDto";
import { EventResponseDto } from "../dto/EventResponseDto";
import { ListEventOverridesQueryDto } from "../dto/ListEventOverridesQueryDto";
import { ListEventsQueryDto } from "../dto/ListEventsQueryDto";
import { SetEventOverrideDto } from "../dto/SetEventOverrideDto";

@ApiBearerAuth()
@ApiTags("events")
@Controller("events")
export class EventsController {
  constructor(
    @Inject(EVENT_STORE) private readonly store: EventStore,
    @Inject(EVENT_OVERRIDE_STORE)
    private readonly overrides: EventOverrideStore,
  ) {}

  @Get()
  @ApiOkResponse({ type: EventResponseDto, isArray: true })
  list(@Query() query: ListEventsQueryDto): Promise<EventResponseDto[]> {
    return this.store.listEvents(query);
  }

  /**
   * Bulk lookup for the badge the UI shows next to overridden events — one
   * request for a whole page of events rather than N. Distinct path shape
   * (single segment) from ":source/:uid" (two segments) below, so there's
   * no routing ambiguity between the two.
   */
  @Get("overrides")
  @ApiOkResponse({ type: EventOverrideResponseDto, isArray: true })
  listOverrides(
    @Query() query: ListEventOverridesQueryDto,
  ): Promise<EventOverrideResponseDto[]> {
    const ids = query.ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return this.overrides.listOverrides(ids);
  }

  @Get(":source/:uid")
  @ApiOkResponse({ type: EventResponseDto })
  @ApiNotFoundResponse({ description: "No event for that source/uid" })
  async getOne(
    @Param("source") source: string,
    @Param("uid") uid: string,
  ): Promise<EventResponseDto> {
    const event = await this.store.getEvent(source, uid);
    if (!event) {
      throw new NotFoundException(
        `No event for source="${source}" uid="${uid}"`,
      );
    }
    return event;
  }

  @Get(":source/:uid/override")
  @ApiOkResponse({ type: EventOverrideResponseDto })
  @ApiNotFoundResponse({
    description: "No event for that source/uid, or no override is set for it",
  })
  async getOverride(
    @Param("source") source: string,
    @Param("uid") uid: string,
  ): Promise<EventOverrideResponseDto> {
    const event = await this.getEventOrThrow(source, uid);
    const override = await this.overrides.getOverride(event.id);
    if (!override) {
      throw new NotFoundException(
        `No override set for source="${source}" uid="${uid}"`,
      );
    }
    return override;
  }

  @Put(":source/:uid/override")
  @ApiOkResponse({ type: EventOverrideResponseDto })
  @ApiNotFoundResponse({ description: "No event for that source/uid" })
  async setOverride(
    @Param("source") source: string,
    @Param("uid") uid: string,
    @Body() body: SetEventOverrideDto,
  ): Promise<EventOverrideResponseDto> {
    const event = await this.getEventOrThrow(source, uid);
    return this.overrides.setOverride(event.id, body.status);
  }

  @Delete(":source/:uid/override")
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "No event for that source/uid" })
  async clearOverride(
    @Param("source") source: string,
    @Param("uid") uid: string,
  ): Promise<void> {
    const event = await this.getEventOrThrow(source, uid);
    await this.overrides.clearOverride(event.id);
  }

  private async getEventOrThrow(
    source: string,
    uid: string,
  ): Promise<EventResponseDto> {
    const event = await this.store.getEvent(source, uid);
    if (!event) {
      throw new NotFoundException(
        `No event for source="${source}" uid="${uid}"`,
      );
    }
    return event;
  }
}
