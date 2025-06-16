import { ListNotesResponse, Note } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
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
} from "../../convert/minerva/NoteConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlListNotesResponse = {
  minerva_note_associations: {
    note: GraphQlNote;
  }[];
};

@Controller()
export class GetNotesForEntityController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/notes/entity/:entityType/:entityId")
  @ApiOperation({
    summary: "Lists notes for a particular day",
    description: "Lists notes for a particular day.",
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
    const queryRequest = gql`
      query GetNotesForEntity($entityId: String!, $entityType: String!) {
        minerva_note_associations(
          where: {
            _and: { itemId: { _eq: $entityId }, itemType: { _eq: $entityType } }
          }
          order_by: { createdTime: desc }
        ) {
          note {
            author
            createdTime
            deletedTime
            flagged
            id
            lastUpdatedTime
            title
            summary
            type
            value
            associatedItems {
              createdTime
              itemId
              itemType
              noteId
            }
          }
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotesResponse>(queryRequest, {
        entityType: entityType,
        entityId: entityId,
      });
    console.log(queryResponse);

    const notes: Note[] = [];
    queryResponse.minerva_note_associations.forEach((associatedNote) => {
      notes.push(toDomainObject(associatedNote.note));
    });

    const responseBody: ListNotesResponse = {
      notes: notes,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
