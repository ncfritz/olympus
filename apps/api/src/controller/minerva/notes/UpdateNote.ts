import {
  EmptyResponse,
  Note,
  UpdateNoteRequest,
  SingleNoteResponse,
} from "@ncfritz/olympus-model";
import {
  Body,
  Controller,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Res,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNote,
  toDomainObject,
} from "../../../convert/minerva/NoteConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlUpdateNoteResponse = {
  update_minerva_notes_by_pk: GraphQlNote;
};

@Controller()
export class UpdateNoteController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/v1/note/:noteId")
  @ApiOperation({
    summary: "Updates an existing note",
    description: "CUpdates an existing node.",
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
    }

    const updateRequest = gql`
      mutation UpdateNote($id: uuid!, $changes: minerva_notes_set_input = {}) {
        update_minerva_notes_by_pk(pk_columns: { id: $id }, _set: $changes) {
          id
          author
          createdTime
          lastUpdatedTime
          deletedTime
          type
          flagged
          title
          summary
          value
          associatedItems {
            itemId
            itemType
            createdTime
          }
        }
      }
    `;

    const updateResponse =
      await this.graphQLClient.request<GraphQlUpdateNoteResponse>(
        updateRequest,
        { id: noteId, changes: request.note },
      );

    if (updateResponse.update_minerva_notes_by_pk === null) {
      throw new NotFoundException();
    }

    const updatedNote: Note = toDomainObject(
      updateResponse.update_minerva_notes_by_pk,
    );

    const responseBody: SingleNoteResponse = {
      note: updatedNote,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
