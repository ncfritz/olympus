import { DescribeTVEpisodeResponse, Episode } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../../../convert/dionysus/metadata/tvEpisodeConverter";
import { MEDIA_ASSET } from "../../../../query/dionysus/media/mediaAsset";
import { SEARCH_CONFIGURATION } from "../../../../query/dionysus/media/searchConfigutation";
import { GraphQlTvEpisode } from "../../../../types/dionysus/metadata/tvEpisode";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetTvEpisodeResponse = {
  dionysus_tv_episodes_by_pk: GraphQlTvEpisode;
};

@Controller({ version: "1" })
export class GetTvEpisodeByIdController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/tvEpisodes/:episodeId")
  @ApiOperation({
    summary: "Describes a TV episode in Dionysus",
    description: "Retrieves the details of a TV episode in Dionysus.",
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
    @Param("episodeId") episodeId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query GetTvEpisodeById(
        $episodeId: numeric!
      ) {
        dionysus_tv_episodes_by_pk(id: $episodeId) {
          createdTime
          id
          lastUpdatedTime
          name
          overview
          externalIds {
            createdTime
            externalId
            lastUpdatedTime
            type
          }
          videos {
            country {
              createdTime
              id
              lastUpdatedTime
              name
            }
            createdTime
            id
            key
            language {
              createdTime
              lastUpdatedTime
              id
              name
              nativeName
            }
            lastUpdatedTime
            name
            official
            publishedDate
            site
            size
            type
          }
          images {
            createdTime
            filePath
            height
            language {
              createdTime
              id
              lastUpdatedTime
              name
              nativeName
            }
            lastUpdatedTime
            type
            width
          }
          episodeNumber
          airDate
          productionCode
          runtime
          seasonNumber
          stillPath
          voteCount
          voteAverage
          series {
            adult
            backdropPath
            createdTime
            lastAirDate
            inProduction
            id
            firstAirDate
            lastEpisodeToAirId
            lastUpdatedTime
            name
            numberOfEpisodes
            numberOfSeasons
            originalName
            overview
            posterPath
            status
            tagline
            type
          }
          ${MEDIA_ASSET}
          season {
            airDate
            createdTime
            id
            lastUpdatedTime
            name
            overview
            posterPath
            seasonNumber
            voteAverage
            episodes_aggregate {
              aggregate {
                count
              }
            }
            ${SEARCH_CONFIGURATION}
          }
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetTvEpisodeResponse>(
        fetchRequest,
        {
          episodeId: episodeId,
        },
      );

    if (!fetchResponse.dionysus_tv_episodes_by_pk) {
      throw new NotFoundException();
    }

    const fetchedTvEpisode: Episode = toDomainObject(
      fetchResponse.dionysus_tv_episodes_by_pk,
    );

    const responseBody: DescribeTVEpisodeResponse = {
      episode: fetchedTvEpisode,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
