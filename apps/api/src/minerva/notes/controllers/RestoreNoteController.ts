import { SingleNoteResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Res,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlNote, toDomainObject } from "../converters/NoteConverter";
import { NOTE_WITH_ASSOCIATIONS } from "../queries/notes";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlRestoreNoteResponse = {
  update_minerva_notes_by_pk: (GraphQlNote & { affected_rows: number }) | null;
};

@Controller({ version: "1" })
export class RestoreNoteController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Patch("/note/:noteId")
  @ApiOperation({
    summary: "Restores a deleted note",
    description: "Restores a soft-deleted note by clearing its deleted time.",
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
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const restoreNoteResponse =
      await this.graphQLClient.request<GraphQlRestoreNoteResponse>(
        restoreNoteRequest,
        { id: noteId },
      );

    if (restoreNoteResponse.update_minerva_notes_by_pk === null) {
      throw new NotFoundException(`Note with id ${noteId} not found`);
    }

    const note = toDomainObject(restoreNoteResponse.update_minerva_notes_by_pk);
    const responseBody: SingleNoteResponse = {
      note: note,
    };

    response.status(HttpStatus.OK).json(responseBody);
  }
}
