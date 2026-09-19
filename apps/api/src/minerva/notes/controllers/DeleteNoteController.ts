import { SingleNoteResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NoteService } from "../services/NoteService";

@Controller({ version: "1" })
export class DeleteNoteController {
  constructor(private readonly notes: NoteService) {}

  @Delete("/note/:noteId")
  @ApiOperation({
    summary: "Deletes an existing note",
    description:
      "Deletes an existing node using a soft/hard deletion policy. A note is first soft-deleted by " +
      "stamping a `deletedTime` on the entry.  In a soft-deletion state a note it recoverable.  If " +
      "this API is called on a note that has already been soft-deleted, the note will be permanently " +
      "removed from the database and will be unrecoverable.",
    operationId: "DeleteNote",
    tags: ["Notes"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to retrieve",
    type: String,
  })
  @ApiOkResponse({
    description: "The note has been successfully soft deleted.",
    type: SingleNoteResponse,
  })
  @ApiNoContentResponse({
    description: "The note has been successfully hard deleted.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    const { note, hardDeleted } = await this.notes.delete(noteId);
    const responseBody: SingleNoteResponse = { note };
    response
      .status(hardDeleted ? HttpStatus.NO_CONTENT : HttpStatus.OK)
      .json(responseBody);
  }
}
