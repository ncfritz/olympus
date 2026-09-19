import { DescribeTVSeriesResponse, TVSeries } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../converters/tvSeriesConverter";
import { TV_SERIES } from "../queries/tvSeries";
import { GraphQlTvSeries } from "../types/tvSeries";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvSeriesResponse = {
  dionysus_tv_series_by_pk: GraphQlTvSeries;
};

@Controller({ version: "1" })
export class DescribeTvSeriesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tvSeries/:tvSeriesId")
  @ApiOperation({
    summary: "Describes a TV series in Dionysus",
    description: "Retrieves the details of a TV series in Dionysus.",
    operationId: "DescribeTvSeries",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "tvSeriesId",
    description: "The ID of the TV series to describe",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeTVSeriesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("tvSeriesId", ParseIntPipe) tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeTvSeries($id: numeric!) {
        dionysus_tv_series_by_pk(id: $id) {
          ${TV_SERIES}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvSeriesResponse>(
        fetchRequest,
        {
          id: tvSeriesId,
        },
      );

    if (!fetchResponse.dionysus_tv_series_by_pk) {
      throw new NotFoundException();
    }

    const fetchedTvSeries: TVSeries = toDomainObject(
      fetchResponse.dionysus_tv_series_by_pk,
    );

    const responseBody: DescribeTVSeriesResponse = {
      tvSeries: fetchedTvSeries,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
