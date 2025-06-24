import { Note, SingleNoteResponse } from "@ncfritz/olympus-model";
import { Controller, Delete, HttpStatus, NotFoundException, Param, Res } from "@nestjs/common";
import {
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  GraphQlNote,
  toDomainObject,
} from "../../convert/minerva/NoteConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlGetDeletedTimeResponse = {
  minerva_notes_by_pk: {
    deletedTime: string;
  };
};

type GraphQlSoftDeleteNoteResponse = {
  update_minerva_notes_by_pk: GraphQlNote;
};

type GraphQlHardDeleteNoteResponse = {
  delete_minerva_notes_by_pk: GraphQlNote;
};

@Controller()
export class DeleteNoteController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Delete("/v1/note/:noteId")
  @ApiOperation({
    summary: "Deleted an existing note",
    description: "Deleted an existing node.",
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
    description: "The record has been successfully soft deleted.",
    type: SingleNoteResponse,
  })
  @ApiNoContentResponse({
    description: "The record has been successfully hard deleted.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    let responseCode = HttpStatus.NOT_MODIFIED;
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
      throw new NotFoundException();
    }

    if (getDeletedTimeResponse.minerva_notes_by_pk.deletedTime === null) {
      const softDeleteNoteRequest = gql`
        mutation SoftDeleteNote($id: uuid!, $timestamp: timestamptz!) {
          update_minerva_notes_by_pk(
            pk_columns: { id: $id }
            _set: { deletedTime: $timestamp }
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
          delete_minerva_notes_by_pk(id: $id) {
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

      const hardDeleteNoteResponse =
        await this.graphQLClient.request<GraphQlHardDeleteNoteResponse>(
          hardDeleteNoteRequest,
          { id: noteId },
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
