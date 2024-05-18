import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import { SingleNoteResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNote,
  toDomainObject,
} from "../../convert/minerva/NoteConverter";
import { NotFoundClientError } from "../../error";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlDescribeNoteResponse = {
  minerva_notes_by_pk: GraphQlNote;
};

@Controller()
export class DescribeNoteController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/note/:noteId")
  @ApiOperation({
    summary: "Gets a single note by ID",
    description: "Gets a single note by ID",
    operationId: "DescribeNote",
  })
  @ApiTags("Notes")
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

    const queryResponse =
      await this.graphQLClient.request<GraphQlDescribeNoteResponse>(
        queryRequest,
        {
          id: noteId,
        },
      );

    if (queryResponse.minerva_notes_by_pk === null) {
      response.status(HttpStatus.NOT_FOUND).end();
      return;
    }

    if (!queryResponse.minerva_notes_by_pk) {
      throw new NotFoundClientError(`Note with id ${noteId} not found`);
    }

    const note = toDomainObject(queryResponse.minerva_notes_by_pk);
    const responseBody: SingleNoteResponse = {
      note: note,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
