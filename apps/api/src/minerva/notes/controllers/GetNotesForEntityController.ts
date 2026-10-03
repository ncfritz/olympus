import { ListNotesResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
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
export class GetNotesForEntityController {
  constructor(private readonly notes: NoteService) {}

  @Get("/notes/entity/:entityType/:entityId")
  @RequiresIdentity()
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
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "No access token, or one that does not verify.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @CurrentPrincipal() principal: Principal | undefined,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Res() response: Response,
  ): Promise<void> {
    const user = requireUser(principal);
    const responseBody: ListNotesResponse = {
      notes: await this.notes.listForEntity(user.userId, entityType, entityId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
