import { ListMoviesResponse, SortDirection } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiFilterParams,
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { MovieService } from "../services/MovieService";

@Controller({ version: "1" })
export class ListMoviesController {
  constructor(private readonly movies: MovieService) {}

  @Get("/metadata/movies")
  @ApiOperation({
    summary: "Lists movies",
    description:
      "Lists movies.  This API accepts pagination and filter parameters to refine the " +
      "list of movies fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListMovies",
    tags: ["Batch"],
  })
  @ApiProduces("application/json")
  @ApiFilterParams()
  @ApiPaginationParams()
  @ApiOkResponse({
    description:
      "The list of movies.  If there are more movies to list, a pagination token will be present.",
    type: () => ListMoviesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 24,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "popularity",
    @Query("filters") filters = undefined,
    @Res() response: Response,
  ): Promise<void> {
    const page = await this.movies.list({
      pageSize,
      startPage,
      sortDirection,
      sortField,
      filters,
    });

    const responseBody: ListMoviesResponse = {
      movies: page.movies,
      count: page.count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
