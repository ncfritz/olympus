import {
  ListProductionCompanyMoviesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../../utils/controllerDecorators";
import { ProductionCompanyService } from "../services/ProductionCompanyService";

@Controller({ version: "1" })
export class ListProductionCompanyMoviesController {
  constructor(private readonly productionCompanies: ProductionCompanyService) {}

  @Get("/metadata/productionCompany/:productionCompanyId/movies")
  @ApiOperation({
    summary: "Lists the movies associated with a production company",
    description:
      "Lists the movies associated with a production company.  This API accepts pagination parameters, but does not " +
      "offer filtering capabilities.",
    operationId: "ListProductionCompanyMovies",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiPaginationParams()
  @ApiParam({
    name: "productionCompanyId",
    description: "The ID of the production company to list movies for",
    type: Number,
  })
  @ApiOkResponse({
    type: ListProductionCompanyMoviesResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("productionCompanyId", ParseIntPipe) productionCompanyId: number,
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const { movies, count } = await this.productionCompanies.listMovies(
      productionCompanyId,
      { pageSize, startPage, sortField, sortDirection },
    );

    const responseBody: ListProductionCompanyMoviesResponse = {
      movies: movies,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
