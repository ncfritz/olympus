import { ListKeywordsResponse, SortDirection } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { KeywordService } from "../services/KeywordService";

@Controller({ version: "1" })
export class ListKeywordsController {
  constructor(private readonly keywords: KeywordService) {}

  @Get("/metadata/keywords")
  @ApiOperation({
    summary: "Lists keywords",
    description:
      "Lists keywords.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of keywords fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListKeywords",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListKeywordsResponse,
    description:
      "The list of keywords.  If there are more keywords to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const { keywords, count } = await this.keywords.list({
      pageSize,
      startPage,
      sortField,
      sortDirection,
    });

    const responseBody: ListKeywordsResponse = {
      keywords: keywords,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
