import { ListNotesResponse } from "@ncfritz/olympus-model";
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
export class GetNotesForEntityController {
  constructor(private readonly notes: NoteService) {}

  @Get("/notes/entity/:entityType/:entityId")
  @ApiOperation({
    summary: "Lists notes associated with an entity",
    description:
      "Lists all notes that are associated with an identified entity.",
    operationId: "GetNotesForEntity",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "entityType",
    description: "The type of entity to get notes for",
    type: String,
  })
  @ApiParam({
    name: "entityId",
    description: "The id of the entity to get notes for",
    type: String,
  })
  @ApiOkResponse({
    description: "The notes have been successfully fetched.",
    type: ListNotesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListNotesResponse = {
      notes: await this.notes.listForEntity(entityType, entityId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
