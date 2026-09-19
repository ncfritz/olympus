import { DescribeTVEpisodeResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
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
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { TvEpisodeService } from "../services/TvEpisodeService";

@Controller({ version: "1" })
export class GetTvEpisodeByIdController {
  constructor(private readonly tvEpisodes: TvEpisodeService) {}

  @Get("/metadata/tvEpisodes/:episodeId")
  @ApiOperation({
    summary: "Describes a TV episode by its ID",
    description: "Retrieves the details of a TV episode by its TMDB ID.",
    operationId: "GetTvEpisodeById",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "episodeId",
    description: "The ID of the TV episode",
    type: Number,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeTVEpisodeResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("episodeId", ParseIntPipe) episodeId: number,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: DescribeTVEpisodeResponse = {
      episode: await this.tvEpisodes.describeById(episodeId),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
