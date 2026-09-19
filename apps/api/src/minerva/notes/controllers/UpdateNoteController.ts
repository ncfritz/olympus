import {
  EmptyResponse,
  UpdateNoteRequest,
  SingleNoteResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NoteService } from "../services/NoteService";

@Controller({ version: "1" })
export class UpdateNoteController {
  constructor(private readonly notes: NoteService) {}

  @Put("/note/:noteId")
  @ApiOperation({
    summary: "Updates an existing note",
    description: "Applies the given changes to a note.",
    operationId: "UpdateNote",
    tags: ["Notes"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to retrieve",
    type: String,
  })
  @ApiBody({
    type: UpdateNoteRequest,
    required: true,
    description: "Input for the UpdateNote operation",
  })
  @ApiOkResponse({
    description: "The record has been successfully created.",
    type: SingleNoteResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "No updates to the record were required.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Body() request: UpdateNoteRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (Object.keys(request.note).length === 0) {
      response.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    const responseBody: SingleNoteResponse = {
      note: await this.notes.update(noteId, request.note),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
