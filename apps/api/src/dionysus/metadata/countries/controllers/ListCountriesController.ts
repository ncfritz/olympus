import { ListCountriesResponse, SortDirection } from "@ncfritz/olympus-model";
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
import { CountryService } from "../services/CountryService";

@Controller({ version: "1" })
export class ListCountriesController {
  constructor(private readonly countries: CountryService) {}

  @Get("/metadata/countries")
  @ApiOperation({
    summary: "Lists countries",
    description:
      "Lists countries.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of countries fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListCountries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "pageSize",
    type: Number,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListCountriesResponse,
    description:
      "The list of countries.  If there are more countries to list, a pagination token will be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const { countries, count } = await this.countries.list({
      pageSize,
      startPage,
      sortField,
      sortDirection,
    });

    const responseBody: ListCountriesResponse = {
      countries: countries,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
