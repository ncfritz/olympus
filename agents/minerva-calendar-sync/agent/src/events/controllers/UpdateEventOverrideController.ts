import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  UpdateEventOverrideRequest,
  UpdateEventOverrideResponse,
} from "../../model/events";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { EventOverrideService } from "../services/EventOverrideService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class UpdateEventOverrideController {
  constructor(private readonly eventOverrides: EventOverrideService) {}

  @Put("/event/:eventId/override")
  @ApiOperation({
    summary: "Updates an event override",
    description:
      "Sets the availability an event counts as, whatever its synced status.",
    operationId: "UpdateEventOverride",
    tags: ["Event Overrides"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "eventId",
    description: "The ID of the event (source:uid)",
    type: String,
  })
  @ApiBody({
    type: UpdateEventOverrideRequest,
    required: true,
    description: "The override to set.",
  })
  @ApiOkResponse({
    description: "The override was stored.",
    type: UpdateEventOverrideResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("eventId") eventId: string,
    @Body() request: UpdateEventOverrideRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateEventOverrideResponse = {
      eventOverride: await this.eventOverrides.update(
        eventId,
        request.eventOverride.status,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
