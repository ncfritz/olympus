import {
  ListMediaAssetWorkflowsResponse,
  MediaAssetWorkflowListItem,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toMediaAssetWorkflowListItemDomainObject } from "../../../convert/dionysus/media/MediaAssetWorkflowConverter";
import { MEDIA_ASSET_WORKFLOW_LIST_ITEM } from "../../../query/dionysus/media/mediaAssetWorkflow";
import { GraphQlMediaAssetWorkflowListItem } from "../../../types/dionysus/media/mediaAssetWorkflow";
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
  dionysus_media_asset_workflow: GraphQlMediaAssetWorkflowListItem[];
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
          ${MEDIA_ASSET_WORKFLOW_LIST_ITEM}
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
    const fetchedWorkflows: MediaAssetWorkflowListItem[] = [];

    fetchResponse.dionysus_media_asset_workflow.forEach((result) => {
      fetchedWorkflows.push(toMediaAssetWorkflowListItemDomainObject(result));
    });

    const responseBody: ListMediaAssetWorkflowsResponse = {
      workflows: fetchedWorkflows,
      count:
        fetchResponse.dionysus_media_asset_workflow_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
