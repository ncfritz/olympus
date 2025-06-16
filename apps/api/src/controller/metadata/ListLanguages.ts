import {
  Language,
  ListLanguagesResponse,
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
import { toDomainObject } from "../../convert/metadata/LanguageConverter";
import { GraphQlLanguage } from "../../types/batchJobs";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../utils/controllerDecorators";

type GraphQlListLanguagesResponse = {
  dionysus_languages: GraphQlLanguage[];
  dionysus_languages_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

@Controller()
export class ListLanguagesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/metadata/languages")
  @ApiOperation({
    summary: "Lists languages",
    description:
      "Lists languages.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of languages fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListLanguages",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of languages.  If there are more languages to list, a pagination token will be present.",
    type: () => ListLanguagesResponse,
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
      query ListLanguages {
      dionysus_languages(limit: ${pageSize}, offset: ${
        pageSize * startPage
      }, order_by: {${sortField}: ${sortDirection}}) {
        createdTime
        id
        lastUpdatedTime
        name
        nativeName
      }
      dionysus_languages_aggregate {
        aggregate {
          count
        }
      }
    }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListLanguagesResponse>(
        fetchRequest,
      );
    const fetchedLanguages: Language[] = [];

    fetchResponse.dionysus_languages.forEach((result) => {
      fetchedLanguages.push(toDomainObject(result));
    });

    const responseBody: ListLanguagesResponse = {
      languages: fetchedLanguages,
      count: fetchResponse.dionysus_languages_aggregate.aggregate.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
