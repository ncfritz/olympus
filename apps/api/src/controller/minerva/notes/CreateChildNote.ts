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
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { BaseNoteController } from "./BaseNoteController";
import { DescribeNoteController } from "./DescribeNote";
import { setLocation } from "../../../utils/location";

@Controller({ version: "1" })
export class CreateChildNoteController extends BaseNoteController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

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
    const createdNote = await this.createNote(request.note, noteId);

    const responseBody: SingleNoteResponse = {
      note: createdNote,
    };

    setLocation(response, httpRequest, DescribeNoteController, {
      noteId: createdNote.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
