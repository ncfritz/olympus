import { CreateNoteRequest, SingleNoteResponse } from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import {
  CurrentPrincipal,
  RequiresIdentity,
} from "../../../auth/authDecorators";
import { type Principal, requireUser } from "../../../auth/principal";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { DescribeNoteController } from "./DescribeNoteController";
import { setLocation } from "../../../utils/location";
import { NoteService } from "../services/NoteService";

@Controller({ version: "1" })
export class CreateNoteController {
  constructor(private readonly notes: NoteService) {}

  @Post("/notes")
  @RequiresIdentity()
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
        schema: { type: "string" },
        description: "The location of the created note",
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() request: CreateNoteRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const note = await this.notes.create(user.userId, request.note);
    setLocation(response, httpRequest, DescribeNoteController, {
      noteId: note.id,
    });
    const responseBody: SingleNoteResponse = { note };
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
