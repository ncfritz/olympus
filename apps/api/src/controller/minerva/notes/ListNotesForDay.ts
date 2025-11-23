import { ListNotesResponse, Note } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  GraphQlNote,
  toDomainObject,
} from "../../../convert/minerva/NoteConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlListNotesResponse = {
  minerva_notes: GraphQlNote[];
};

@Controller({ version: "1" })
export class ListNotesForDayController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/notes/:start")
  @ApiOperation({
    summary: "Lists notes for a particular day",
    description: "Lists notes for a particular day.",
    operationId: "ListNotesForDay",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "start",
    description: "The timestamp to start from",
    type: String,
  })
  @ApiQuery({
    name: "days",
    description: "The number of days to fetch",
    required: false,
    type: Number,
  })
  @ApiOkResponse({
    description: "The notes have been successfully fetched.",
    type: ListNotesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("start") start: string,
    @Query("days") days: number = 1,
    @Res() response: Response,
  ): Promise<void> {
    const startTime = moment(start).utc();
    const endTime = moment(startTime).add({ days: days });

    const queryRequest = gql`
      query ListNotesForDay(
        $author: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_notes(
          where: {
            author: { _eq: $author }
            _and: {
              createdTime: { _gte: $start }
              _and: { createdTime: { _lt: $end } }
            }
          }
          order_by: { createdTime: desc }
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

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotesResponse>(queryRequest, {
        author: "ncfritz",
        start: startTime,
        end: endTime,
      });

    const notes: Note[] = [];
    queryResponse.minerva_notes.forEach((note) => {
      notes.push(toDomainObject(note));
    });

    const responseBody: ListNotesResponse = {
      notes: notes,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
