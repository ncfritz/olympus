import { SingleNoteResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNote,
  toDomainObject,
} from "../../../convert/minerva/NoteConverter";
import { NOTE_WITH_ASSOCIATIONS } from "../../../query/minerva/notes";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlDescribeNoteResponse = {
  minerva_notes_by_pk: GraphQlNote;
};

@Controller({ version: "1" })
export class DescribeNoteController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/note/:noteId")
  @ApiOperation({
    summary: "Gets a single note by ID",
    description:
      "Gets a single note by ID.  The note returned will be a fully populated note including " +
      "any associations, as well as parent and child notes.",
    operationId: "DescribeNote",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to retrieve",
    type: String,
  })
  @ApiOkResponse({
    description: "The notes have been successfully fetched.",
    type: SingleNoteResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    const queryRequest = gql`
      query DescribeNote($id: uuid!) {
        minerva_notes_by_pk(id: $id) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeNoteResponse>(
        queryRequest,
        {
          id: noteId,
        },
      );

    if (!queryResponse.minerva_notes_by_pk) {
      throw new NotFoundException(`Note with id ${noteId} not found`);
    }

    const note = toDomainObject(queryResponse.minerva_notes_by_pk);
    const responseBody: SingleNoteResponse = {
      note: note,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
