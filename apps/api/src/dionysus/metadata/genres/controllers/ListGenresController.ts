import { ListGenresResponse, SortDirection } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { GenreService } from "../services/GenreService";

@Controller({ version: "1" })
export class ListGenresController {
  constructor(private readonly genres: GenreService) {}

  @Get("/metadata/genres")
  @ApiOperation({
    summary: "Lists genres",
    description:
      "Lists genres.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of genres fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListGenres",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListGenresResponse,
    description:
      "The list of genres.  If there are more genres to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const { genres, count } = await this.genres.list(
      {
        pageSize: pageSize,
        startPage: startPage,
        sortDirection: sortDirection,
        sortField: sortField,
      },
      filters,
    );

    const responseBody: ListGenresResponse = {
      genres: genres,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
