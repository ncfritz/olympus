import { DescribeMovieResponse, Movie } from "@ncfritz/olympus-model";
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
import { MEDIA_ASSET } from "../../../../query/dionysus/media/mediaAsset";
import { GraphQlMovie } from "../../../../types/dionysus/metadata/movie";
import { toDomainObject } from "../../../../convert/dionysus/metadata/MovieConverter";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

type GraphQlGetMovieResponse = {
  dionysus_movies_by_pk: GraphQlMovie;
};

@Controller({ version: "1" })
export class DescribeMovieController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/metadata/movie/:movieId")
  @ApiOperation({
    summary: "Describes a movie in Dionysus",
    description: "Retrieves the details of a movie in Dionysus.",
    operationId: "DescribeMovie",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "movieId",
    description: "The ID of the movie to describe",
    type: Number,
    required: true,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeMovieResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId") movieId: number,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query FetchMovie($id: numeric!) {
        dionysus_movies_by_pk(id: $id) {
          adult
          backdropPath
          budget
          createdTime
          homepage
          id
          imdbId
          lastUpdatedTime
          originalTitle
          overview
          popularity
          posterPath
          releaseDate
          revenue
          runtime
          status
          tagline
          title
          voteAverage
          voteCount
          video
          alternativeTitles {
            country {
              createdTime
              id
              lastUpdatedTime
              name
            }
            createdTime
            lastUpdatedTime
            title
            type
          }
          externalIds {
            createdTime
            externalId
            lastUpdatedTime
            type
          }
          genres {
            genre {
              createdTime
              id
              lastUpdatedTime
              name
              type
            }
            createdTime
            lastUpdatedTime
          }
          images {
            createdTime
            filePath
            height
            width
            type
            lastUpdatedTime
            language {
              createdTime
              lastUpdatedTime
              name
              nativeName
              id
            }
          }
          keywords {
            createdTime
            lastUpdatedTime
            keyword {
              createdTime
              id
              lastUpdatedTime
              value
            }
          }
          productionCountries {
            createdTime
            lastUpdatedTime
            country {
              name
              createdTime
              id
              lastUpdatedTime
            }
          }
          releaseDates {
            certification {
              certification
              country
              createdTime
              lastUpdatedTime
              meaning
              order
              type
            }
            country {
              createdTime
              id
              lastUpdatedTime
              name
            }
            createdTime
            language {
              createdTime
              id
              lastUpdatedTime
              name
              nativeName
            }
            lastUpdatedTime
            note
            releaseDate
            type
          }
          productionCompanies {
            createdTime
            lastUpdatedTime
            productionCompany {
              alternativeNames {
                createdTime
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
              lastUpdatedTime
              logo
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
            type
            size
            site
            publishedTime
            official
            name
            lastUpdatedTime
            language {
              createdTime
              id
              lastUpdatedTime
              name
              nativeName
            }
            key
            id
            createdTime
            country {
              createdTime
              id
              lastUpdatedTime
              name
            }
          }
          originalLanguage {
            createdTime
            id
            lastUpdatedTime
            name
            nativeName
          }
          ${MEDIA_ASSET}
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetMovieResponse>(fetchRequest, {
        id: movieId,
      });

    if (!fetchResponse.dionysus_movies_by_pk) {
      throw new NotFoundException();
    }

    const fetchedMovie: Movie = toDomainObject(
      fetchResponse.dionysus_movies_by_pk,
    );

    const responseBody: DescribeMovieResponse = {
      movie: fetchedMovie,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
