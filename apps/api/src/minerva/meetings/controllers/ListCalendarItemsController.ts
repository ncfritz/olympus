import { ListCalendarItemsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { MeetingService } from "../services/MeetingService";

@Controller({ version: "1" })
export class ListCalendarItemsController {
  constructor(private readonly meetings: MeetingService) {}

  @Get("/meetings/:start")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists calendar items for a period",
    description:
      "Lists the calendar items starting on the given day and continuing for the requested number of days.",
    operationId: "ListCalendarItems",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "start",
    description: "The timestamp to start from",
    type: String,
  })
  @ApiQuery({
    name: "days",
    description: "The number of days to fetch",
    required: false,
    type: Number,
  })
  @ApiOkResponse({
    description: "The calendar items have been successfully fetched.",
    type: ListCalendarItemsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("start") start: string,
    @Query("days", new DefaultValuePipe(1), ParseIntPipe) days: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const responseBody: ListCalendarItemsResponse = {
      items: await this.meetings.list(user.userId, start, days),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
