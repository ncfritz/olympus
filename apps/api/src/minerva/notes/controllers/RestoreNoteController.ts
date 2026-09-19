import { SingleNoteResponse } from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Param, Patch, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NoteService } from "../services/NoteService";

@Controller({ version: "1" })
export class RestoreNoteController {
  constructor(private readonly notes: NoteService) {}

  @Patch("/note/:noteId")
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
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleNoteResponse = {
      note: await this.notes.restore(noteId),
    };
    response.status(HttpStatus.OK).json(responseBody);
  }
}
