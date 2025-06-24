import { DescribePersonResponse, Person } from "@ncfritz/olympus-model";
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
import { GraphQlPerson } from "../../../types/dionysus/metadata";
import { toDomainObject } from "../../../convert/metadata/PersonConverter";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type GraphQlGetPersonResponse = {
  dionysus_people_by_pk: GraphQlPerson;
};

@Controller()
export class DescribePersonController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/v1/dionysus/person/:personId")
  @ApiOperation({
    summary: "Describes a person in Dionysus",
    description: "Retrieves the details of a person in Dionysus.",
    operationId: "DescribePerson",
    tags: ["Metadata"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "entityId",
    description: "The ID of the person to describe",
    type: String,
    required: true,
  })
  @ApiParam({
    name: "personId",
    description: "The ID of the person to describe",
    type: String,
  })
  @ApiOkResponse({
    description: "The record has been successfully fetched.",
    type: DescribePersonResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("personId") personId: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query FetchPerson($id: numeric!) {
        dionysus_people_by_pk(id: $id) {
          adult
          alsoKnownAs {
            createdTime
            id
            lastUpdatedTime
            name
          }
          biography
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
              id
              lastUpdatedTime
              name
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
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetPersonResponse>(fetchRequest, {
        id: personId,
      });

    if (!fetchResponse.dionysus_people_by_pk) {
      throw new NotFoundException();
    }

    const fetchedPerson: Person = toDomainObject(
      fetchResponse.dionysus_people_by_pk,
    );

    const responseBody: DescribePersonResponse = {
      person: fetchedPerson,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
