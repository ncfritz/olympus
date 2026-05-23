import {
  GetMeetingStatisticsResponse,
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
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment-timezone";
import {
  ApiStandardErrorResponses,
  HeaderTimezone,
} from "../../../utils/controllerDecorators";

type GraphQlGetMonthlyCountsResponse = {
  minerva_meeting_hour_statistics: [
    {
      count: number;
      duration: number;
      hour: string;
      status: MeetingStatus;
    },
  ];
  minerva_meeting_day_statistics: [
    {
      count: number;
      duration: number;
      day: string;
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

@Controller({ version: "1" })
export class GetMeetingsStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/meetings/statistics/:start")
  @ApiOperation({
    summary: "Gets the monthly summary for meetings",
    description: "Gets monthly summary for meetings",
    operationId: "GetMeetingsStatistics",
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
    type: GetMeetingStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @HeaderTimezone() tz: string,
    @Param("start") start: string,
    @Query("days") days: number,
    @Res() response: Response,
  ): Promise<void> {
    const startDate = moment(start);
    const endDate = moment(startDate)
      .add(days + 1, "days")
      .subtract(1, "second");
    const queryInput = {
      start: startDate,
      end: endDate,
      tz: tz,
    };

    const hourOfDayStatistics: Record<string, MeetingStatusStatistics> = {};
    const dayOfWeekStatistics: Record<string, MeetingStatusStatistics> = {};

    for (let i = 0; i < 24; i++) {
      hourOfDayStatistics[i.toString().padStart(2, "0")] = EMPTY_COUNTS();
    }

    for (let i = 1; i <= 7; i++) {
      dayOfWeekStatistics[i.toString()] = EMPTY_COUNTS();
    }

    const statisticsRequest = gql`
      query GetMeetingStatistics(
        $tz: String!
        $start: timestamptz!
        $end: timestamptz!
      ) {
        minerva_meeting_hour_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
        ) {
          count
          duration
          hour
          status
        }
        minerva_meeting_day_statistics(
          args: { start_date: $start, end_date: $end, tz: $tz }
        ) {
          count
          day
          duration
          status
        }
      }
    `;

    const statisticsResponse =
      await this.graphQLClient.request<GraphQlGetMonthlyCountsResponse>(
        statisticsRequest,
        queryInput,
      );

    statisticsResponse.minerva_meeting_hour_statistics.forEach((entry) => {
      hourOfDayStatistics[entry.hour][entry.status].count += entry.count;
      hourOfDayStatistics[entry.hour][entry.status].totalDurationMin +=
        entry.duration;
    });

    statisticsResponse.minerva_meeting_day_statistics.forEach((entry) => {
      dayOfWeekStatistics[entry.day][entry.status].count += entry.count;
      dayOfWeekStatistics[entry.day][entry.status].totalDurationMin +=
        entry.duration;
    });

    const responseBody: GetMeetingStatisticsResponse = {
      hourOfDayStatistics: hourOfDayStatistics,
      dayOfWeekStatistics: dayOfWeekStatistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
