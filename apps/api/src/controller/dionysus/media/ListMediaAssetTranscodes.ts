import {
  DecoratedMediaAssetWorkflowStep,
  FilterDefinition,
  FilterType,
  ListMediaAssetTranscodesResponse,
  MediaAssetWorkflowStepType,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDecoratedDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowStepConverter";
import { BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlDecoratedMediaAssetWorkflowStep } from "../../../types/dionysus/media/mediaAssetWorkflow";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
  parseFilterDefinition,
} from "../../../utils/filterUtil";

export type GraphQlListMediaAssetTranscodesResponse = {
  dionysus_media_asset_workflow_step: GraphQlDecoratedMediaAssetWorkflowStep[];
  dionysus_media_asset_workflow_step_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

const STEP_TYPE_FILTER: FilterDefinition = {
  type: FilterType.EQUALS,
  name: "type",
  value: MediaAssetWorkflowStepType.TRANSCODE,
};

@Controller({ version: "1" })
export class ListMediaAssetTranscodesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/transcodes")
  @ApiOperation({
    summary: "Lists media transcodes",
    description: "Lists media transcodes.",
    operationId: "ListMediaAssetTranscodes",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of transcodes.  If there are more results to list, a pagination token will be present.",
    type: () => ListMediaAssetTranscodesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "startedTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const userFilters = parseFilterDefinition(filters);
    let queryFilters = STEP_TYPE_FILTER;

    if (userFilters) {
      queryFilters = {
        type: FilterType.AND,
        name: "_and",
        value: [STEP_TYPE_FILTER, userFilters],
      };
    }

    const whereExpression = buildFilterExpression(queryFilters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListMediaAssetTranscodes {
        dionysus_media_asset_workflow_step(${[
          paginationExpression,
          whereExpression,
        ].join(", ")}) {
          ${BASE_DECORATED_MEDIA_ASSET_WORKFLOW_STEP}
        }
        dionysus_media_asset_workflow_step_aggregate${
          whereExpression ? `(${whereExpression})` : ""
        } {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMediaAssetTranscodesResponse>(
        fetchRequest,
      );
    const fetchedTranscodces: DecoratedMediaAssetWorkflowStep[] = [];

    fetchResponse.dionysus_media_asset_workflow_step.forEach(
      (configuration) => {
        fetchedTranscodces.push(toDecoratedDomainObject(configuration));
      },
    );

    const responseBody: ListMediaAssetTranscodesResponse = {
      steps: fetchedTranscodces,
      count:
        fetchResponse.dionysus_media_asset_workflow_step_aggregate.aggregate
          .count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
