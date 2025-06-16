import {
  GetMeetingSummaryResponse,
  MeetingStatus,
  MeetingStatusStatistics,
} from "@ncfritz/olympus-model";
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
  minerva_meeting_status_statistics: [
    {
      count: number;
      duration: number;
      start_date: string;
      status: MeetingStatus;
    },
  ];
};

const EMPTY_COUNTS = (): MeetingStatusStatistics => {
  return {
    [MeetingStatus.Free]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.Busy]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.Tentative]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.OOF]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.NoData]: { count: 0, totalDurationMin: 0 },
    [MeetingStatus.WorkingElsewhere]: { count: 0, totalDurationMin: 0 },
  };
};

@Controller()
export class GetMeetingsSummaryController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/meetings/summary/:start")
  @ApiOperation({
    summary: "Gets the monthly summary for meetings",
    description: "Gets monthly summary for meetings",
    operationId: "GetMeetingsSummaryController",
    tags: ["Meetings"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "start",
    description: "The start date to get statistics for",
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
    type: GetMeetingSummaryResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @HeaderTimezone() tz: string,
    @Param("start") start: string,
    @Query("days") days: number,
    @Res() response: Response,
  ): Promise<void> {
    const startDate = moment(start);
    const endDate = moment(startDate).add(days + 1, "days");
    const queryInput = {
      start: startDate,
      end: endDate,
      tz: tz,
    };
    const statusStatistics: Record<string, MeetingStatusStatistics> = {};

    for (let m = moment(startDate), i = 0; i <= days; m.add(1, "days"), i++) {
      statusStatistics[m.format("YYYY-MM-DD")] = EMPTY_COUNTS();
    }

    const statisticsRequest = gql`
      query GetMeetingStatistics(
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_meeting_status_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
        ) {
          count
          duration
          status
          start_date
        }
      }
    `;

    const statisticsResponse =
      await this.graphQLClient.request<GraphQlGetMonthlyCountsResponse>(
        statisticsRequest,
        queryInput,
      );

    statisticsResponse.minerva_meeting_status_statistics.forEach((entry) => {
      if (!(entry.start_date in statusStatistics)) {
        return;
      }

      statusStatistics[entry.start_date][entry.status].count += entry.count;
      statusStatistics[entry.start_date][entry.status].totalDurationMin +=
        entry.duration;
    });

    const responseBody: GetMeetingSummaryResponse = {
      statusStatistics: statusStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
