import { Injectable } from "@nestjs/common";
import {
  GetMailStatisticsResponse,
  MailStatisticsRange,
  MailStatisticsScope,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment, { type Moment } from "moment";
import {
  GraphQlMailLabelStatistics,
  GraphQlMailLabelYear,
  GraphQlMailSenderStatistics,
  GraphQlMailSenderYear,
  GraphQlMailStatisticsSummary,
  toLabelStatistics,
  toLabelYear,
  toSenderStatistics,
  toSenderYear,
  toSummary,
} from "../converters/MailStatisticsConverter";

/** How many senders and labels the Statistics page charts. */
export const MAIL_STATISTICS_TOP = {
  senders: 15,
  labels: 15,
  senderActivity: 5,
  labelActivity: 20,
};

/** The start of `range` counted back from `now`; undefined for all time. */
export const sinceOf = (
  range: MailStatisticsRange,
  now: Moment,
): Moment | undefined => {
  switch (range) {
    case MailStatisticsRange.TwelveMonths:
      return moment(now).subtract(12, "months");
    case MailStatisticsRange.ThreeYears:
      return moment(now).subtract(3, "years");
    case MailStatisticsRange.AllTime:
      return undefined;
  }
};

type GraphQlGetMailStatisticsResponse = {
  minerva_mail_statistics_summary: GraphQlMailStatisticsSummary[];
  minerva_mail_top_senders: GraphQlMailSenderStatistics[];
  minerva_mail_top_labels: GraphQlMailLabelStatistics[];
  minerva_mail_sender_years: GraphQlMailSenderYear[];
  minerva_mail_label_years: GraphQlMailLabelYear[];
};

/**
 * Mail statistics (docs/plans/email-management phase 2): the Statistics
 * page's numbers over the caller's mail, computed by SQL functions from
 * the stored metadata on each request.
 */
@Injectable()
export class MailStatisticsService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  async getStatistics(
    userId: string,
    range: MailStatisticsRange,
    scope: MailStatisticsScope,
    now: Moment = moment(),
  ): Promise<GetMailStatisticsResponse> {
    const since = sinceOf(range, now);
    const query = gql`
      query GetMailStatistics(
        $userId: uuid!
        $since: timestamptz
        $scope: String!
        $topSenders: Int!
        $topLabels: Int!
        $senderActivity: Int!
        $labelActivity: Int!
      ) {
        minerva_mail_statistics_summary(
          args: { for_user: $userId, since: $since, scope: $scope }
        ) {
          messages
          labelsInUse
          senders
          unlabelled
          firstReceivedTime
          lastReceivedTime
        }
        minerva_mail_top_senders(
          args: {
            for_user: $userId
            since: $since
            scope: $scope
            top: $topSenders
          }
        ) {
          address
          name
          messages
          lastReceivedTime
        }
        minerva_mail_top_labels(
          args: {
            for_user: $userId
            since: $since
            scope: $scope
            top: $topLabels
          }
        ) {
          name
          messages
          senders
          lastReceivedTime
        }
        minerva_mail_sender_years(
          args: {
            for_user: $userId
            since: $since
            scope: $scope
            top: $senderActivity
          }
        ) {
          address
          year
          messages
        }
        minerva_mail_label_years(
          args: {
            for_user: $userId
            since: $since
            scope: $scope
            top: $labelActivity
          }
        ) {
          name
          year
          messages
        }
      }
    `;
    const response =
      await this.graphQLClient.request<GraphQlGetMailStatisticsResponse>(
        query,
        {
          userId,
          since: since?.toISOString() ?? null,
          scope,
          topSenders: MAIL_STATISTICS_TOP.senders,
          topLabels: MAIL_STATISTICS_TOP.labels,
          senderActivity: MAIL_STATISTICS_TOP.senderActivity,
          labelActivity: MAIL_STATISTICS_TOP.labelActivity,
        },
      );

    return {
      range,
      scope,
      ...(since ? { sinceTime: since } : {}),
      summary: toSummary(response.minerva_mail_statistics_summary[0]),
      topSenders: response.minerva_mail_top_senders.map(toSenderStatistics),
      topLabels: response.minerva_mail_top_labels.map(toLabelStatistics),
      senderActivity: response.minerva_mail_sender_years.map(toSenderYear),
      labelActivity: response.minerva_mail_label_years.map(toLabelYear),
    };
  }
}
