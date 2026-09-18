import {
  ListMediaAssetWorkflowsResponse,
  DecoratedMediaAssetWorkflow,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDecoratedDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowConverter";
import { DECORATED_MEDIA_ASSET_WORKFLOW } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlDecoratedMediaAssetWorkflow } from "../../../types/dionysus/media/mediaAssetWorkflow";
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

export type GraphQlListMediaAssetWorkflowsResponse = {
  dionysus_media_asset_workflow: GraphQlDecoratedMediaAssetWorkflow[];
  dionysus_media_asset_workflow_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListMediaAssetWorkflowsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/media/workflows")
  @ApiOperation({
    summary: "Lists media asset workflows",
    description:
      "Lists media asset workflows.  By default this API will nly return the latest 30 workflows.",
    operationId: "ListMediaAssetWorkflows",
    tags: ["Media"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of workflows.  If there are more workflows to list, a pagination token will be present.",
    type: () => ListMediaAssetWorkflowsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const userFilters = parseFilterDefinition(filters);
    const whereExpression = buildFilterExpression(userFilters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListMediaAssetWorkflows {
        dionysus_media_asset_workflow(${[
          paginationExpression,
          whereExpression,
        ].join(", ")}) {
          ${DECORATED_MEDIA_ASSET_WORKFLOW}
        }
        dionysus_media_asset_workflow_aggregate${
          whereExpression ? `(${whereExpression})` : ""
        } {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListMediaAssetWorkflowsResponse>(
        fetchRequest,
      );
    const fetchedWorkflows: DecoratedMediaAssetWorkflow[] = [];

    fetchResponse.dionysus_media_asset_workflow.forEach((result) => {
      fetchedWorkflows.push(toDecoratedDomainObject(result));
    });

    const responseBody: ListMediaAssetWorkflowsResponse = {
      workflows: fetchedWorkflows,
      count:
        fetchResponse.dionysus_media_asset_workflow_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
