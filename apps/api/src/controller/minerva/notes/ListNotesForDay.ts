import {
  FilterDefinition,
  FilterType,
  ListNotesResponse,
  Note,
} from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
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
import { buildFilterExpression } from "../../../utils/filterUtil";

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
    @Query("days", new DefaultValuePipe(1), ParseIntPipe) days: number,
    @Res() response: Response,
  ): Promise<void> {
    const startTime = moment(start).utc();
    const endTime = moment(startTime).add({ days: days });

    const authorFilter: FilterDefinition = {
      name: "author",
      type: FilterType.EQUALS,
      value: "ncfritz",
    };
    const dateFilter: FilterDefinition = {
      name: "_",
      type: FilterType.AND,
      value: [
        {
          name: "createdTime",
          type: FilterType.GREATER_THAN_EQUAL,
          value: startTime.toISOString(),
        },
        {
          name: "createdTime",
          type: FilterType.LESS_THAN,
          value: endTime.toISOString(),
        },
      ],
    };
    const childFilter: FilterDefinition = {
      name: "parent_id",
      type: FilterType.IS_NULL,
      value: true,
    };
    const filters: FilterDefinition = {
      name: "_",
      type: FilterType.AND,
      value: [authorFilter, dateFilter, childFilter],
    };

    const whereExpression = buildFilterExpression(filters);

    const queryRequest = gql`
      query ListNotesForDay {
        minerva_notes(
          ${whereExpression},
          order_by: { createdTime: desc }
        ) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotesResponse>(queryRequest);

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
