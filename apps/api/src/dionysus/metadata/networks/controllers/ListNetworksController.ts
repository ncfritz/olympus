import { ListNetworksResponse, SortDirection } from "@ncfritz/olympus-model";
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
import { NetworkService } from "../services/NetworkService";

@Controller({ version: "1" })
export class ListNetworksController {
  constructor(private readonly networks: NetworkService) {}

  @Get("/metadata/networks")
  @ApiOperation({
    summary: "Lists TV networks",
    description:
      "Lists TV networks.  This API accepts pagination and filter parameters to refine the " +
      "refine the list of companies fetched.  When filtering, any changes in the filter parameters will " +
      "reset the pagination state.",
    operationId: "ListNetworks",
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
    type: ListNetworksResponse,
    description:
      "The list of TV networks.  If there are more companies to list, a pagination token will be present.",
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
    const { networks, count } = await this.networks.list(
      { pageSize, startPage, sortField, sortDirection },
      filters,
    );

    const responseBody: ListNetworksResponse = {
      networks: networks,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
