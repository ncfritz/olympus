import { SingleNoteResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NoteService } from "../services/NoteService";

@Controller({ version: "1" })
export class DescribeNoteController {
  constructor(private readonly notes: NoteService) {}

  @Get("/note/:noteId")
  @ApiOperation({
    summary: "Gets a single note by ID",
    description:
      "Gets a single note by ID.  The note returned will be a fully populated note including " +
      "any associations, as well as parent and child notes.",
    operationId: "DescribeNote",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to retrieve",
    type: String,
  })
  @ApiOkResponse({
    description: "The notes have been successfully fetched.",
    type: SingleNoteResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: SingleNoteResponse = {
      note: await this.notes.describe(noteId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
