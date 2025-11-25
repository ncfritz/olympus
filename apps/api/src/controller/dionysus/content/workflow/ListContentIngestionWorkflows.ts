import {
  ContentIngestionWorkflow,
  ListContentIngestionWorkflowsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/content/workflow/ContentIngestionWorkflowConverter";
import { GraphQLContentIngestionWorkflow } from "../../../../types/dionysus/content/workflow";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import {
  buildFilterExpression,
  buildPaginationExpression,
} from "../../../../utils/filterUtil";

type GraphQLListContentIngestionWorkflowsResponse = {
  dionysus_content_asset_ingest_workflows: GraphQLContentIngestionWorkflow[];
  dionysus_content_asset_ingest_workflows_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListContentIngestionWorkflowsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/content/workflows")
  @ApiOperation({
    summary: "Lists metadata workflows",
    description:
      "Lists content ingestion workflows.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of workflows fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListContentIngestionWorkflows",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "filters",
    type: String,
    required: false,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of workflows.  If there are more workflows to list, a pagination token will be present.",
    type: () => ListContentIngestionWorkflowsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression({
      pageSize: pageSize,
      startPage: startPage,
      sortDirection: sortDirection,
      sortField: sortField,
    });

    const fetchRequest = gql`
      query ListContentIngestionWorkflows {
        dionysus_content_asset_ingest_workflows(${[paginationExpression, whereExpression].join(", ")}) {
          createdTime
          finishedTime
          id
          lastUpdatedTime
          source
          sourceType
          startedTime
          status
          steps_aggregate {
            aggregate {
              count
            }
          }
        }
        dionysus_content_asset_ingest_workflows_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQLListContentIngestionWorkflowsResponse>(
        fetchRequest,
      );
    const fetchedWorkflows: ContentIngestionWorkflow[] = [];

    fetchResponse.dionysus_content_asset_ingest_workflows.forEach((result) => {
      fetchedWorkflows.push(toDomainObject(result));
    });

    const responseBody: ListContentIngestionWorkflowsResponse = {
      workflows: fetchedWorkflows,
      count:
        fetchResponse.dionysus_content_asset_ingest_workflows_aggregate
          .aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
