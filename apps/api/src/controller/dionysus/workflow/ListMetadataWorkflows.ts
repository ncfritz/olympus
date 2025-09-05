import {
  ListWorkflowsResponse,
  SortDirection,
  Workflow,
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
import { toDomainObject } from "../../../convert/dionysus/workflow/WorkflowConverter";
import { GraphQLWorkflow } from "../../../types/workflow";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";

type GraphQLListMetadataWorkflowsResponse = {
  dionysus_metadata_workflow: GraphQLWorkflow[];
  dionysus_metadata_workflow_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller({ version: "1" })
export class ListMetadataWorkflowsController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/workflows")
  @ApiOperation({
    summary: "Lists metadata workflows",
    description:
      "Lists metadata workflows.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of workflows fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListMetadataWorkflows",
    tags: ["Workflow"],
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
    type: () => ListWorkflowsResponse,
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
    const fetchRequest = gql`
      query ListWorkflows {
        dionysus_metadata_workflow(limit: ${pageSize}, 
                                   offset: ${pageSize * startPage}, 
                                   order_by: {${sortField}: ${sortDirection}}) {
          createdTime
          finishedTime
          id
          lastUpdatedTime
          startedTime
          status
          steps_aggregate {
            aggregate {
              count
            }
          }
        }
        dionysus_metadata_workflow_aggregate {
          aggregate {
            count
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQLListMetadataWorkflowsResponse>(
        fetchRequest,
      );
    const fetchedWorkflows: Workflow[] = [];

    fetchResponse.dionysus_metadata_workflow.forEach((result) => {
      fetchedWorkflows.push(toDomainObject(result));
    });

    const responseBody: ListWorkflowsResponse = {
      workflows: fetchedWorkflows,
      count: fetchResponse.dionysus_metadata_workflow_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
