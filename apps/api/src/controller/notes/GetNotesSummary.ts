
import { GetSummaryResponse, NoteTypeCounts } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment-timezone";
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../utils/controllerDecorators";

type GraphQlGetMonthlyCountsResponse = {
  minerva_notes_type_statistics: [
    {
      count: number;
      created: string;
      type: number;
    },
  ];
};

type GraphQlGetHourlyCountsResponse = {
  minerva_notes_hour_statistics: [
    {
      count: number;
      hour: string;
      type: number;
    },
  ];
};

const EMPTY_COUNTS: NoteTypeCounts = {
  note: 0,
  idea: 0,
  thought: 0,
  action: 0,
  praise: 0,
  question: 0,
  total: 0,
};

const getTypeForId = (id: number): keyof NoteTypeCounts => {
  switch (id) {
    case 0:
      return "note";
    case 1:
      return "idea";
    case 2:
      return "thought";
    case 3:
      return "action";
    case 4:
      return "praise";
    case 5:
      return "question";
    default:
      return "note";
  }
};

@Controller()
export class GetMonthlySummaryController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/notes/summary/:start")
  @ApiOperation({
    summary: "Gets the monthly summary for notes",
    description: "Gets monthly summary for notes",
    operationId: "GetNotesSummaryController",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "start",
    description: "The date to start the summary at",
    type: String,
  })
  @ApiQuery({
    name: "days",
    description: "The number of days to fetch statistics for",
    type: Number,
  })
  @ApiHeader({
    name: "x-ncfritz-tz",
    description: "The IANA timezone to execute the query in",
  })
  @ApiOkResponse({
    description: "Monthly summary fetched.",
    type: GetSummaryResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @HeaderTimezone() tz: string,
    @Param("start") start: string,
    @Query("days") days: number,
    @Res() response: Response,
  ): Promise<void> {
    const endDate = moment(start);
    const startDate = moment(endDate).subtract({ days: days });
    const queryInput = {
      start: startDate,
      end: endDate,
      tz: tz,
    };

    const counts: Record<string, NoteTypeCounts> = {};
    const hourly: Record<string, NoteTypeCounts> = {};

    for (
      let m = moment(endDate), i = 0;
      i <= days;
      m.subtract(1, "days"), i++
    ) {
      counts[m.format("YYYY-MM-DD")] = { ...EMPTY_COUNTS };
    }

    for (let i = 1; i <= 24; i++) {
      hourly[i.toString().padStart(2, "0")] = { ...EMPTY_COUNTS };
    }

    const monthlyRequest = gql`
      query GetMonthlyCounts(
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_notes_type_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
        ) {
          created
          count
          type
        }
      }
    `;

    const monthlyResponse =
      await this.graphQLClient.request<GraphQlGetMonthlyCountsResponse>(
        monthlyRequest,
        queryInput,
      );

    monthlyResponse.minerva_notes_type_statistics.forEach((entry) => {
      counts[entry.created][getTypeForId(entry.type)] += entry.count;
      counts[entry.created]["total"] += entry.count;
    });

    const hourlyRequest = gql`
      query GetHourlyCounts(
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_notes_hour_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
        ) {
          count
          hour
          type
        }
      }
    `;

    const hourlyResponse =
      await this.graphQLClient.request<GraphQlGetHourlyCountsResponse>(
        hourlyRequest,
        queryInput,
      );

    hourlyResponse.minerva_notes_hour_statistics.forEach((entry) => {
      hourly[entry.hour][getTypeForId(entry.type)] += entry.count;
      hourly[entry.hour]["total"] += entry.count;
    });

    const responseBody: GetSummaryResponse = {
      counts: counts,
      hourly: hourly,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
