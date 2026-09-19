import { ListLanguagesResponse, SortDirection } from "@ncfritz/olympus-model";
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
import { LanguageService } from "../services/LanguageService";

@Controller({ version: "1" })
export class ListLanguagesController {
  constructor(private readonly languages: LanguageService) {}

  @Get("/metadata/languages")
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
    type: ListLanguagesResponse,
    description:
      "The list of languages.  If there are more languages to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const { languages, count } = await this.languages.list({
      pageSize,
      startPage,
      sortField,
      sortDirection,
    });

    const responseBody: ListLanguagesResponse = {
      languages: languages,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
