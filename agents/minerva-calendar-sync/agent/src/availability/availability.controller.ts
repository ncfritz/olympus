import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  AVAILABILITY_STATUS_VALUES,
  AvailabilityStatus,
} from "../domain/availability";
import { AvailabilityService } from "./availability.service";
import { AvailabilitySlotDto } from "./dto/availability-slot.dto";
import { FreeBusyQueryDto } from "./dto/free-busy-query.dto";
import { StatusTimelineQueryDto } from "./dto/status-timeline-query.dto";

@ApiBearerAuth()
@ApiTags("availability")
@Controller("freebusy")
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @ApiOkResponse({
    type: AvailabilitySlotDto,
    isArray: true,
    description: "Computed 15-minute availability slots",
  })
  list(@Query() query: FreeBusyQueryDto): Promise<AvailabilitySlotDto[]> {
    return this.availability.computeSlots(query.start, query.end);
  }

  @Get("timeline")
  @ApiOkResponse({
    description:
      "Computed status per 15-minute chunk across the requested range, keyed by each chunk's start time in minutes since epoch",
    schema: {
      type: "object",
      additionalProperties: {
        type: "string",
        enum: [...AVAILABILITY_STATUS_VALUES],
      },
      example: { "28564020": "busy", "28564035": "none" },
    },
  })
  timeline(
    @Query() query: StatusTimelineQueryDto,
  ): Promise<Record<string, AvailabilityStatus>> {
    return this.availability.computeTimeline(query.start, query.end, {
      dayStart: query.dayStart,
      dayEnd: query.dayEnd,
      treatWeekendsAsWorking: query.treatWeekendsAsWorking,
      timezone: query.timezone,
    });
  }
}
