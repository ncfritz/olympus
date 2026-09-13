import { Controller, Get, Inject, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { EVENT_STORE, EventStore } from "../store/event-store";
import { EventResponseDto } from "./dto/event-response.dto";
import { ListEventsQueryDto } from "./dto/list-events-query.dto";

@ApiBearerAuth()
@ApiTags("events")
@Controller("events")
export class EventsController {
  constructor(@Inject(EVENT_STORE) private readonly store: EventStore) {}

  @Get()
  @ApiOkResponse({ type: EventResponseDto, isArray: true })
  list(@Query() query: ListEventsQueryDto): Promise<EventResponseDto[]> {
    return this.store.listEvents(query);
  }

  @Get(":source/:uid")
  @ApiOkResponse({ type: EventResponseDto })
  @ApiNotFoundResponse({ description: "No event for that source/uid" })
  async getOne(@Param("source") source: string, @Param("uid") uid: string): Promise<EventResponseDto> {
    const event = await this.store.getEvent(source, uid);
    if (!event) {
      throw new NotFoundException(`No event for source="${source}" uid="${uid}"`);
    }
    return event;
  }
}
