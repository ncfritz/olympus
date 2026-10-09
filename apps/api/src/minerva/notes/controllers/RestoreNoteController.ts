import { SingleNoteResponse } from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Param, Patch, Res } from "@nestjs/common";
import {
  ApiConsumes,
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
export class RestoreNoteController {
  constructor(private readonly notes: NoteService) {}

  @Patch("/note/:noteId")
  @RequiresIdentity()
  @ApiOperation({
    summary: "Restores a deleted note",
    description: "Restores a soft-deleted note by clearing its deleted time.",
    operationId: "RestoreNote",
    tags: ["Notes"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to restore",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully restored.",
    type: SingleNoteResponse,
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
    const responseBody: SingleNoteResponse = {
      note: await this.notes.restore(user.userId, noteId),
    };
    response.status(HttpStatus.OK).json(responseBody);
  }
}
