import { ListNotesResponse } from "@ncfritz/olympus-model";
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
import { NoteService } from "../services/NoteService";

@Controller({ version: "1" })
export class ListNotesForDayController {
  constructor(private readonly notes: NoteService) {}

  @Get("/notes/:start")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists notes for a particular day",
    description: "Lists notes for a particular day.",
    operationId: "ListNotesForDay",
    tags: ["Notes"],
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
    description: "The notes have been successfully fetched.",
    type: ListNotesResponse,
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
    const responseBody: ListNotesResponse = {
      notes: await this.notes.listForDays(user.userId, start, days),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
