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
  UsePipes,
  ValidationPipe,
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
export class ListPreviousCalendarItemOccurrencesController {
  constructor(private readonly meetings: MeetingService) {}

  @Get("/meeting/:meetingId/previous")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists previous occurrences of a meeting in a series",
    description:
      "Lists earlier occurrences of a recurring meeting, up to the requested limit.",
    operationId: "ListPreviousCalendarItemOccurrences",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "meetingId",
    description: "The ID of the meeting to retrieve",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    description: "The number of past meetings to fetch",
    type: Number,
    required: false,
  })
  @ApiOkResponse({
    description: "The calendar item have been successfully fetched.",
    type: ListCalendarItemsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  @UsePipes(new ValidationPipe({ transform: true }))
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("meetingId") meetingId: string,
    @Query("limit", new DefaultValuePipe(5), ParseIntPipe) limit: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const responseBody: ListCalendarItemsResponse = {
      items: await this.meetings.listPreviousOccurrences(
        user.userId,
        meetingId,
        limit,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
