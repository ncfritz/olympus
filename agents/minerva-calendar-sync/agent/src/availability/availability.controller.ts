import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AvailabilityService } from "./availability.service";
import { AvailabilitySlotDto } from "./dto/availability-slot.dto";
import { FreeBusyQueryDto } from "./dto/free-busy-query.dto";

@ApiBearerAuth()
@ApiTags("availability")
@Controller("freebusy")
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @ApiOkResponse({ type: AvailabilitySlotDto, isArray: true, description: "Computed 15-minute availability slots" })
  list(@Query() query: FreeBusyQueryDto): Promise<AvailabilitySlotDto[]> {
    return this.availability.computeSlots(query.start, query.end);
  }
}
