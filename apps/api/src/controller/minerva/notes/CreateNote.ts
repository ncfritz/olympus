import { CreateNoteRequest, SingleNoteResponse } from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseNoteController } from "./BaseNoteController";

@Controller({ version: "1" })
export class CreateNoteController extends BaseNoteController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Post("/notes")
  @ApiOperation({
    summary: "Creates a new note",
    description:
      "Creates a new note. After the note has been created, it will be enqueued for indexing and " +
      "other potential asynchronous processing.",
    operationId: "CreateNote",
    tags: ["Notes"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateNoteRequest,
    required: true,
    description: "Input for the CreateNote operation",
  })
  @ApiCreatedResponse({
    description: "The note has been successfully created.",
    type: SingleNoteResponse,
    headers: {
      Location: {
        description: "The location of the created note",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateNoteRequest,
    @Res() response: Response,
  ): Promise<void> {
    const createdNote = await this.createNote(request.note);

    const responseBody: SingleNoteResponse = {
      note: createdNote,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/note/${encodeURIComponent(
          createdNote.id,
        )}`,
      )
      .send(responseBody);
  }
}
