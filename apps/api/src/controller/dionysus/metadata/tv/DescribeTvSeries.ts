import { DescribeTVSeriesResponse, TVSeries } from "@ncfritz/olympus-model";
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
import { toDomainObject } from "../../../../convert/dionysus/metadata/tvSeriesConverter";
import { GraphQlTvSeries } from "../../../../types/dionysus/metadata/tvSeries";
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
    @Param("tvSeriesId") tvSeriesId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query DescribeTvSeries($id: numeric!) {
        dionysus_tv_series_by_pk(id: $id) {
          adult
          backdropPath
          createdTime
          firstAirDate
          homepage
          id
          inProduction
          lastAirDate
          lastUpdatedTime
          name
          numberOfEpisodes
          numberOfSeasons
          originalName
          overview
          popularity
          posterPath
          status
          tagline
          type
          voteAverage
          voteCount
          originalLanguage {
            createdTime
            id
            lastUpdatedTime
            name
            nativeName
          }
          alternativeTitles {
            createdTime
            country {
              createdTime
              id
              lastUpdatedTime
              name
            }
            lastUpdatedTime
            title
            type
          }
          certifications {
            certification {
              certification
              country
              createdTime
              lastUpdatedTime
              meaning
              order
              type
            }
            createdTime
            lastUpdatedTime
          }
          episodeRunTimes {
            createdTime
            lastUpdatedTime
            runTime
          }
          externalIds {
            createdTime
            externalId
            lastUpdatedTime
            type
          }
          genres {
            lastUpdatedTime
            createdTime
            genre {
              createdTime
              id
              lastUpdatedTime
              name
              type
            }
          }
          keywords {
            createdTime
            lastUpdatedTime
            keyword {
              createdTime
              lastUpdatedTime
              value
              id
            }
          }
          languages {
            createdTime
            lastUpdatedTime
            language {
              nativeName
              name
              lastUpdatedTime
              createdTime
              id
            }
          }
          originCountries {
            lastUpdatedTime
            createdTime
            country {
              createdTime
              id
              lastUpdatedTime
              name
            }
          }
          spokenLanguages {
            createdTime
            language {
              createdTime
              id
              lastUpdatedTime
              name
              nativeName
            }
            lastUpdatedTime
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
          seasons(order_by: { seasonNumber: desc }) {
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
          }
          productionCountries {
            createdTime
            lastUpdatedTime
            country {
              createdTime
              id
              lastUpdatedTime
              name
            }
          }
          productionCompanies {
            createdTime
            lastUpdatedTime
            productionCompany {
              alternativeNames {
                createdTime
                id
                lastUpdatedTime
                name
                type
              }
              country {
                createdTime
                id
                lastUpdatedTime
                name
              }
              createdTime
              description
              headquarters
              homepage
              id
              logo
              lastUpdatedTime
              name
            }
          }
          networks {
            createdTime
            lastUpdatedTime
            network {
              country {
                createdTime
                id
                lastUpdatedTime
                name
              }
              createdTime
              headquarters
              homepage
              id
              images {
                createdTime
                filePath
                fileType
                height
                id
                lastUpdatedTime
                width
              }
              lastUpdatedTime
              logo
              name
            }
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
          lastEpisodeToAir {
            airDate
            createdTime
            episodeNumber
            id
            lastUpdatedTime
            name
            overview
            productionCode
            runtime
            seasonNumber
            stillPath
            voteCount
            voteAverage
          }
          nextEpisodeToAir {
            airDate
            createdTime
            episodeNumber
            id
            lastUpdatedTime
            name
            overview
            productionCode
            runtime
            seasonNumber
            stillPath
            voteCount
            voteAverage
          }
          createdBy {
            createdTime
            lastUpdatedTime
            person {
              adult
              birthday
              birthplace
              createdTime
              deathday
              gender
              homepage
              id
              imdbId
              knownForDepartment
              lastUpdatedTime
              name
              profilePath
            }
          }
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
