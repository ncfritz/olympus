import {
  ListProductionCompaniesResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
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
import { ProductionCompanyService } from "../services/ProductionCompanyService";

@Controller({ version: "1" })
export class ListProductionCompaniesController {
  constructor(private readonly productionCompanies: ProductionCompanyService) {}

  @Get("/metadata/productionCompanies")
  @ApiOperation({
    summary: "Lists production companies",
    description:
      "Lists production companies.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of companies fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListProductionCompanies",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "filters",
    type: String,
    required: false,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListProductionCompaniesResponse,
    description:
      "The list of production companies.  If there are more companies to list, a pagination token will be present.",
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
    const { companies, count } = await this.productionCompanies.list(
      { pageSize, startPage, sortField, sortDirection },
      filters,
    );

    const responseBody: ListProductionCompaniesResponse = {
      companies: companies,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
