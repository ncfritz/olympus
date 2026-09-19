import {
  ListProductionCompanyTvSeriesResponse,
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
export class ListProductionCompanyTvSeriesController {
  constructor(private readonly productionCompanies: ProductionCompanyService) {}

  @Get("/metadata/productionCompany/:productionCompanyId/tvSeries")
  @ApiOperation({
    summary: "Lists the TV series associated with a production company",
    description:
      "Lists the TV Series associated with a production company.  This API accepts pagination parameters, but does not " +
      "offer filtering capabilities.",
    operationId: "ListProductionCompanyTvSeries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiPaginationParams()
  @ApiParam({
    name: "productionCompanyId",
    description: "The ID of the production company to list tvSeries for",
    type: Number,
  })
  @ApiOkResponse({
    type: ListProductionCompanyTvSeriesResponse,
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
    const { tvSeries, count } = await this.productionCompanies.listTvSeries(
      productionCompanyId,
      { pageSize, startPage, sortField, sortDirection },
    );

    const responseBody: ListProductionCompanyTvSeriesResponse = {
      tvSeries: tvSeries,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
