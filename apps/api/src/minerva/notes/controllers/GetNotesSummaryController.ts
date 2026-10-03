import { GetSummaryResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
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
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../../utils/controllerDecorators";
import { NoteService } from "../services/NoteService";

@Controller({ version: "1" })
export class GetNotesSummaryController {
  constructor(private readonly notes: NoteService) {}

  @Get("/notes/summary/:start")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Gets the monthly summary for notes",
    description: "Gets a monthly summary of notes.",
    operationId: "GetNotesSummary",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "start",
    description: "The date to start the summary at",
    type: String,
  })
  @ApiQuery({
    name: "days",
    description: "The number of days to fetch statistics for",
    type: Number,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    description: "The IANA timezone to execute the query in",
  })
  @ApiOkResponse({
    description: "Monthly summary fetched.",
    type: GetSummaryResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @HeaderTimezone() tz: string,
    @Param("start") start: string,
    @Query("days", ParseIntPipe) days: number,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const responseBody: GetSummaryResponse = await this.notes.getSummary(
      user.userId,
      start,
      days,
      tz,
    );
    response.status(HttpStatus.OK).send(responseBody);
  }
}
