import {
  ListNetworkTvSeriesResponse,
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
import { NetworkService } from "../services/NetworkService";

@Controller({ version: "1" })
export class ListNetworkTvSeriesController {
  constructor(private readonly networks: NetworkService) {}

  @Get("/metadata/network/:networkId/tvSeries")
  @ApiOperation({
    summary: "Lists the TV series associated with a network",
    description:
      "Lists the TV Series associated with a network.  This API accepts pagination parameters, but does not " +
      "offer filtering capabilities.",
    operationId: "ListNetworkTvSeries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiPaginationParams()
  @ApiParam({
    name: "networkId",
    description: "The ID of the network to list TV Series for",
    type: Number,
  })
  @ApiOkResponse({
    type: ListNetworkTvSeriesResponse,
    description:
      "The list of TV series for the network.  If there are more TV series to list, a pagination token will " +
      "be present.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("networkId", ParseIntPipe) networkId: number,
    @Query("pageSize") pageSize = 100,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const { tvSeries, count } = await this.networks.listTvSeries(networkId, {
      pageSize,
      startPage,
      sortField,
      sortDirection,
    });

    const responseBody: ListNetworkTvSeriesResponse = {
      tvSeries: tvSeries,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
