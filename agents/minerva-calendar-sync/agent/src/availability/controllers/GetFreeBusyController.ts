import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  GetFreeBusyQuery,
  GetFreeBusyResponse,
} from "../../model/availability";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AvailabilityService } from "../services/AvailabilityService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class GetFreeBusyController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get("/availability/free-busy")
  @ApiOperation({
    summary: "Gets free/busy slots",
    description:
      "Returns the combined availability of every calendar included in busy, per 15-minute slot of the range, after overrides.",
    operationId: "GetFreeBusy",
    tags: ["Availability"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The slots were computed.",
    type: GetFreeBusyResponse,
  })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.NOT_FOUND] })
  async handle(
    @Query() query: GetFreeBusyQuery,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: GetFreeBusyResponse = {
      slots: await this.availability.getFreeBusy(query),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
