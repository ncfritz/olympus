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
import { GraphQlMovie } from "../../../types/dionysus/metadata";
import { toDomainObject } from "../../../convert/metadata/MovieConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetMovieResponse = {
  dionysus_movies_by_pk: GraphQlMovie;
};

@Controller()
export class DescribeMovieController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/dionysus/movie/:movieId")
  @ApiOperation({
    summary: "Describes a movie in Dionysus",
    description: "Retrieves the details of a movie in Dionysus.",
    operationId: "DescribeMovie",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "entityId",
    description: "The ID of the movie to describe",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "movieId",
    description: "The ID of the movie to describe",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribeMovieResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("movieId") movieId: string,
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
          posterPath
          releaseDate
          revenue
          runtime
          status
          tagline
          title
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
          cast {
            character
            createdTime
            creditId
            lastUpdatedTime
            order
            originalName
            castId
            person {
              adult
              alsoKnownAs {
                createdTime
                lastUpdatedTime
                name
              }
              biography
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
              externalIds {
                createdTime
                externalId
                lastUpdatedTime
                type
              }
              images {
                createdTime
                filePath
                height
                id
                lastUpdatedTime
                width
                language {
                  createdTime
                  lastUpdatedTime
                  name
                  nativeName
                  id
                }
              }
            }
          }
          crew {
            createdTime
            creditId
            department
            job
            lastUpdatedTime
            originalName
            person {
              adult
              biography
              alsoKnownAs {
                createdTime
                lastUpdatedTime
                name
              }
              birthday
              birthplace
              createdTime
              deathday
              externalIds {
                createdTime
                externalId
                id
                lastUpdatedTime
                type
              }
              gender
              homepage
              id
              images {
                language {
                  createdTime
                  lastUpdatedTime
                  name
                  nativeName
                  id
                }
                createdTime
                filePath
                height
                id
                lastUpdatedTime
                width
              }
              imdbId
              knownForDepartment
              lastUpdatedTime
              name
              profilePath
            }
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
