import { CreateNoteRequest, SingleNoteResponse } from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { DescribeNoteController } from "./DescribeNoteController";
import { setLocation } from "../../../utils/location";
import { NoteService } from "../services/NoteService";

@Controller({ version: "1" })
export class CreateChildNoteController {
  constructor(private readonly notes: NoteService) {}

  @Post("/note/:noteId/children")
  @ApiOperation({
    summary: "Creates a new child note",
    description:
      "Creates a new child note. After the note has been created, it will be enqueued for indexing and " +
      "other potential asynchronous processing.",
    operationId: "CreateChildNote",
    tags: ["Notes"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateNoteRequest,
    required: true,
    description: "Input for the CreateChildNote operation",
  })
  @ApiParam({
    name: "noteId",
    description:
      "The ID of the parent note.  The newly created note will be a child of this note.",
    type: String,
  })
  @ApiCreatedResponse({
    description: "The note has been successfully created.",
    type: SingleNoteResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created note",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateNoteRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
    @Param("noteId") noteId: string,
  ): Promise<void> {
    const note = await this.notes.create(request.note, noteId);
    setLocation(response, httpRequest, DescribeNoteController, {
      noteId: note.id,
    });
    const responseBody: SingleNoteResponse = { note };
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
