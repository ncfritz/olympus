import { Note, SingleNoteResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Delete,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  GraphQlNote,
  toDomainObject,
} from "../../../convert/minerva/NoteConverter";
import { NOTE_WITH_ASSOCIATIONS } from "../../../query/minerva/notes";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { logger } from "../../../utils/logger";

type GraphQlGetDeletedTimeResponse = {
  minerva_notes_by_pk: {
    deletedTime: string;
  };
};

type GraphQlSoftDeleteNoteResponse = {
  update_minerva_notes_by_pk: GraphQlNote;
};

type GraphQlHardDeleteNoteResponse = {
  update_minerva_notes: {
    affected_rows: number;
  };
  delete_minerva_notes_by_pk: GraphQlNote;
};

@Controller({ version: "1" })
export class DeleteNoteController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Delete("/note/:noteId")
  @ApiOperation({
    summary: "Deletes an existing note",
    description:
      "Deletes an existing node using a soft/hard deletion policy. A note is first soft-deleted by " +
      "stamping a `deletedTime` on the entry.  In a soft-deletion state a note it recoverable.  If " +
      "this API is called on a note that has already been soft-deleted, the note will be permanently " +
      "removed from the database and will be unrecoverable.",
    operationId: "DeleteNote",
    tags: ["Notes"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to retrieve",
    type: String,
  })
  @ApiOkResponse({
    description: "The note has been successfully soft deleted.",
    type: SingleNoteResponse,
  })
  @ApiNoContentResponse({
    description: "The note has been successfully hard deleted.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    let responseCode: HttpStatus;
    let note: Note;

    const getDeletedTimeRequest = gql`
      query GetDeletedTime($id: uuid!) {
        minerva_notes_by_pk(id: $id) {
          deletedTime
        }
      }
    `;

    const getDeletedTimeResponse =
      await this.graphQLClient.request<GraphQlGetDeletedTimeResponse>(
        getDeletedTimeRequest,
        { id: noteId },
      );

    if (getDeletedTimeResponse.minerva_notes_by_pk === null) {
      throw new NotFoundException(`Note with id ${noteId} not found`);
    }

    logger.debug(
      `Note ${noteId} deletedTime: ${getDeletedTimeResponse.minerva_notes_by_pk.deletedTime}`,
    );

    if (getDeletedTimeResponse.minerva_notes_by_pk.deletedTime === null) {
      const softDeleteNoteRequest = gql`
        mutation SoftDeleteNote($id: uuid!, $timestamp: timestamptz!) {
          update_minerva_notes_by_pk(
            pk_columns: { id: $id }
            _set: { deletedTime: $timestamp }
          ) {
            ${NOTE_WITH_ASSOCIATIONS}
          }
        }
      `;

      const softDeleteNoteResponse =
        await this.graphQLClient.request<GraphQlSoftDeleteNoteResponse>(
          softDeleteNoteRequest,
          { id: noteId, timestamp: moment.utc() },
        );

      note = toDomainObject(softDeleteNoteResponse.update_minerva_notes_by_pk);
      responseCode = HttpStatus.OK;
    } else {
      const hardDeleteNoteRequest = gql`
        mutation HardDeleteNote($id: uuid!) {
          update_minerva_notes(where: {parent_id: {_eq: $id}}, _set: {parent_id: null}) {
            affected_rows
          }
          delete_minerva_notes_by_pk(id: $id) {
            ${NOTE_WITH_ASSOCIATIONS}
          }
        }
      `;

      const hardDeleteNoteResponse =
        await this.graphQLClient.request<GraphQlHardDeleteNoteResponse>(
          hardDeleteNoteRequest,
          { id: noteId },
        );

      logger.info(
        `Disassociated ${hardDeleteNoteResponse.update_minerva_notes.affected_rows} child notes.`,
      );

      note = toDomainObject(hardDeleteNoteResponse.delete_minerva_notes_by_pk);
      responseCode = HttpStatus.NO_CONTENT;
    }

    const responseBody: SingleNoteResponse = {
      note: note,
    };

    response.status(responseCode).json(responseBody);
  }
}
