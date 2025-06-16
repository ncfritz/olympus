import {
  CreatePersonRequest,
  PartialPersonAlsoKnownAs,
  PartialPersonExternalId,
  PartialPersonImage,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlCreatePersonResponse = {
  insert_dionysus_people_one: {
    id: string;
  };
};

@Controller()
export class CreatePersonController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/v1/metadata/people")
  @ApiOperation({
    summary: "Upserts a person",
    description: "Creates or updates a person.",
    operationId: "CreatePerson",
    tags: ["Metadata"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreatePersonRequest,
    required: true,
    description: "Input for the CreatePerson operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreatePersonRequest,
    headers: {
      Location: {
        description: "The location of the created person",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreatePersonRequest,
    @Res() response: Response,
  ): Promise<void> {
    const insertRequest = gql`
      mutation CreatePerson(
        $id: numeric!
        $name: String!
        $adult: Boolean!
        $biography: String
        $birthday: String
        $birthplace: String
        $deathday: String
        $gender: numeric
        $homepage: String
        $imdbId: String
        $knownForDepartment: String
        $profilePath: String
        $externalIds: [dionysus_person_external_ids_insert_input!]!
        $alsoKnownAs: [dionysus_person_aka_insert_input!]!
        $images: [dionysus_person_images_insert_input!]!
      ) {
        insert_dionysus_people_one(
          object: {
            id: $id
            name: $name
            adult: $adult
            biography: $biography
            birthday: $birthday
            birthplace: $birthplace
            deathday: $deathday
            gender: $gender
            homepage: $homepage
            imdbId: $imdbId
            knownForDepartment: $knownForDepartment
            profilePath: $profilePath
            externalIds: {
              on_conflict: {
                constraint: person_external_ids_pkey
                update_columns: [type, externalId]
              }
              data: $externalIds
            }
            alsoKnownAs: {
              on_conflict: {
                constraint: person_aka_pkey
                update_columns: [name]
              }
              data: $alsoKnownAs
            }
            images: {
              on_conflict: {
                constraint: person_images_pkey
                update_columns: [filePath, width, height, countryCode]
              }
              data: $images
            }
          }
          on_conflict: {
            constraint: people_pkey
            update_columns: [
              name
              adult
              biography
              birthday
              birthplace
              deathday
              gender
              homepage
              imdbId
              knownForDepartment
              profilePath
            ]
          }
        ) {
          id
        }
      }
    `;

    const externalIds: PartialPersonExternalId[] = [];

    request.person.externalIds.forEach((value) => {
      externalIds.push({
        type: value.type,
        externalId: value.externalId,
      });
    });

    const alsoKnownAs: PartialPersonAlsoKnownAs[] = [];

    request.person.alsoKnownAs.forEach((value) => {
      alsoKnownAs.push({
        name: value.name,
      });
    });

    const images: PartialPersonImage[] = [];

    request.person.images.forEach((value) => {
      images.push({
        filePath: value.filePath,
        countryCode: value.countryCode,
        width: value.width,
        height: value.height,
      });
    });

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreatePersonResponse>(
        insertRequest,
        {
          id: request.person.id,
          name: request.person.name,
          adult: request.person.adult,
          biography: request.person.biography,
          birthday: request.person.birthday,
          birthplace: request.person.birthplace,
          deathday: request.person.deathday,
          gender: request.person.gender,
          homepage: request.person.homepage,
          imdbId: request.person.imdbId,
          knownForDepartment: request.person.knownForDepartment,
          profilePath: request.person.profilePath,
          externalIds: externalIds,
          alsoKnownAs: alsoKnownAs,
          images: images,
        },
      );

    console.log(insertResponse);

    const responseBody = {
      id: insertResponse.insert_dionysus_people_one.id,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/metdata/person/${insertResponse.insert_dionysus_people_one.id}`,
      )
      .send(responseBody);
  }
}
