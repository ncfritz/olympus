import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  Keyword,
  ListKeywordsResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/metadata/KeywordConverter";
import { GraphQlKeyword } from "../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../utils/controllerDecorators";

type GraphQlListKeywordsResponse = {
  dionysus_keywords: GraphQlKeyword[];
  dionysus_keywords_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller()
export class ListKeywordsController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/metadata/keywords")
  @ApiOperation({
    summary: "Lists keywords",
    description:
      "Lists keywords.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of keywords fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListKeywords",
  })
  @ApiTags("Metadata")
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of keywords.  If there are more keywords to list, a pagination token will be present.",
    type: () => ListKeywordsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListKeywords {
      dionysus_keywords(limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}) {
        id
        value
        createdTime
        lastUpdatedTime
      }
      dionysus_keywords_aggregate {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListKeywordsResponse>(
        fetchRequest,
      );
    const fetchedKeywords: Keyword[] = [];

    fetchResponse.dionysus_keywords.forEach((result) => {
      fetchedKeywords.push(toDomainObject(result));
    });

    const responseBody: ListKeywordsResponse = {
      keywords: fetchedKeywords,
      count: fetchResponse.dionysus_keywords_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
