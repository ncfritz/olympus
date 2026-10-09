import { ListNotesResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
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
export class ListChildNotesController {
  constructor(private readonly notes: NoteService) {}

  @Get("/note/:noteId/children")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Lists child notes",
    description: "Lists notes that are a child of the specified note.",
    operationId: "ListChildNotes",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to list children for",
    type: String,
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
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const responseBody: ListNotesResponse = {
      notes: await this.notes.listChildren(user.userId, noteId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
