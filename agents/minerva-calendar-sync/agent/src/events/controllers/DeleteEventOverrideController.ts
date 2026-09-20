import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
} from "@nestjs/swagger";
import type { Response } from "express";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { EventOverrideService } from "../services/EventOverrideService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DeleteEventOverrideController {
  constructor(private readonly eventOverrides: EventOverrideService) {}

  @Delete("/event/:eventId/override")
  @ApiOperation({
    summary: "Deletes an event override",
    description:
      "Removes an event's availability override, so its synced status counts again.",
    operationId: "DeleteEventOverride",
    tags: ["Event Overrides"],
  })
  @ApiParam({
    name: "eventId",
    description: "The ID of the event (source:uid)",
    type: String,
  })
  @ApiNoContentResponse({ description: "The event has no override." })
  @ApiStandardErrorResponses({ exclude: [HttpStatus.BAD_REQUEST] })
  async handle(
    @Param("eventId") eventId: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.eventOverrides.delete(eventId);
    response.status(HttpStatus.NO_CONTENT).end();
  }
}
