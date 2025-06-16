import {
  GetMetadataFetchJobStatusStatisticsResponse,
  MetadataFetchJobStatus,
  MetadataJobType,
  Series,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { METADATA_CATEGORY_MAP } from "../../utils/constants";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlGetMetadataJobStats = {
  dionysus_metadata_fetch_status_statistics: [
    { count: number; status: MetadataFetchJobStatus; type: MetadataJobType },
  ];
  dionysus_metadata_fetch_status_expiration_statistics: [
    { count: number; ttl_days: number; type: MetadataJobType },
  ];
};

@Controller()
export class GetMetadataFetchJobStatisticsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/job/metadata/stats")
  @ApiOperation({
    summary: "Get job status counts for metadata fetch jobs",
    description:
      "Retrieves stats for metadat fetch jobs broken down by job type and status.",
    operationId: "GetMetadataFetchJobStatistics",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The statistics were successfully fetched.",
    type: () => GetMetadataFetchJobStatusStatisticsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const fetchRequest = gql`
      query GetMetadataFetchJobStatistics {
        dionysus_metadata_fetch_status_statistics {
          count
          status
          type
        }
        dionysus_metadata_fetch_status_expiration_statistics {
          count
          ttl_days
          type
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMetadataJobStats>(
        fetchRequest,
      );

    const statusCategories: string[] = Object.values(METADATA_CATEGORY_MAP);
    const statusSeries: Record<MetadataFetchJobStatus, number[]> = {
      [MetadataFetchJobStatus.QUEUED]: new Array(statusCategories.length).fill(
        0,
        0,
      ),
      [MetadataFetchJobStatus.INVALIDATED]: new Array(
        statusCategories.length,
      ).fill(0, 0),
      [MetadataFetchJobStatus.FETCHING]: new Array(
        statusCategories.length,
      ).fill(0, 0),
      [MetadataFetchJobStatus.CANCELLED]: new Array(
        statusCategories.length,
      ).fill(0, 0),
      [MetadataFetchJobStatus.FETCHED]: new Array(statusCategories.length).fill(
        0,
        0,
      ),
      [MetadataFetchJobStatus.FAILED]: new Array(statusCategories.length).fill(
        0,
        0,
      ),
      [MetadataFetchJobStatus.NOT_FOUND]: new Array(
        statusCategories.length,
      ).fill(0, 0),
    };

    fetchResponse.dionysus_metadata_fetch_status_statistics.forEach((data) => {
      const seriesIndex = Object.keys(METADATA_CATEGORY_MAP).indexOf(data.type);

      if (seriesIndex > -1) {
        statusSeries[data.status][seriesIndex] = data.count as number;
      }
    });

    const expirationSeries: Series[] = Object.keys(METADATA_CATEGORY_MAP).map(
      (category) => {
        return {
          name: category,
          data: new Array(26).fill(0, 0),
        };
      },
    );

    fetchResponse.dionysus_metadata_fetch_status_expiration_statistics.forEach(
      (data) => {
        const seriesIndex = expirationSeries.findIndex(
          (value) => data.type === value.name,
        );

        if (seriesIndex > -1) {
          expirationSeries[seriesIndex].data[data.ttl_days] =
            data.count as number;
        }
      },
    );

    const modeledResponse: GetMetadataFetchJobStatusStatisticsResponse = {
      status: {
        categories: statusCategories,
        series: statusSeries,
      },
      expiration: {
        series: expirationSeries,
      },
    };

    response.status(HttpStatus.OK).send(modeledResponse);
  }
}
