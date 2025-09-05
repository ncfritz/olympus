import { SingleNoteResponse } from "@ncfritz/olympus-model";
import { Controller, HttpStatus, Param, Patch, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNote,
  toDomainObject,
} from "../../../convert/minerva/NoteConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlRestoreNoteResponse = {
  update_minerva_notes_by_pk: GraphQlNote & { affected_rows: number };
};

@Controller()
export class RestoreNoteController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Patch("/v1/note/:noteId")
  @ApiOperation({
    summary: "Restore an existing note",
    description: "Restore an existing node.",
    operationId: "RestoreNote",
    tags: ["Notes"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to restore",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully restored.",
    type: SingleNoteResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    const restoreNoteRequest = gql`
      mutation RestoreNote($id: uuid!) {
        update_minerva_notes_by_pk(
          pk_columns: { id: $id }
          _set: { deletedTime: null }
        ) {
          id
          author
          createdTime
          lastUpdatedTime
          deletedTime
          flagged
          type
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

    const restoreNoteResponse =
      await this.graphQLClient.request<GraphQlRestoreNoteResponse>(
        restoreNoteRequest,
        { id: noteId },
      );

    const note = toDomainObject(restoreNoteResponse.update_minerva_notes_by_pk);
    const responseBody: SingleNoteResponse = {
      note: note,
    };

    response.status(HttpStatus.OK).json(responseBody);
  }
}
