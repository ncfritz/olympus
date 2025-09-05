import {
  AddContentAssetTagToAssetRequest,
  EmptyResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

type FindTagsQueryResponse = {
  dionysus_content_tags: [
    {
      content_tag_id: string;
    },
  ];
};

type UpdateQueryResponse = {
  insert_dionysus_content_asset_tags: {
    affected_rows: number;
  };
};

type InputQueryResponse = {
  insert_dionysus_content_tags: {
    returning: [
      {
        content_tag_id: string;
      },
    ];
  };
};

@Controller({ version: "1" })
export class AddContentAssetTagToAssetController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Put("/content/asset/:assetId/tags")
  @ApiOperation({
    summary: "Adds a teg to a content asset",
    description:
      "Adds a new tag to a content asset.  If the tag does not exist, it will be created prior " +
      "to attaching it to the content asset",
    operationId: "AddContentAssetTagToAsset",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "assetId",
    description: "The ID of the content asset to add the tag to",
    type: String,
  })
  @ApiBody({
    type: AddContentAssetTagToAssetRequest,
    required: true,
    description: "Input for the AddContentAssetTagToAsset operation",
  })
  @ApiOkResponse({
    description: "The tag has been successfully applied to the content asset.",
    type: EmptyResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_MODIFIED,
    description: "The tag is already present on the content asset.",
    type: EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("assetId") assetId: string,
    @Body() request: AddContentAssetTagToAssetRequest,
    @Res() response: Response,
  ): Promise<void> {
    const findTagsQueryInput = {
      name: request.tag.name,
      type: request.tag.type,
    };

    const findTagQuery = gql`
      query FindContentAssetTag($type: String, $name: String) {
        dionysus_content_tags(
          where: { _and: { type: { _eq: $type }, name: { _ilike: $name } } }
          limit: 1
        ) {
          content_tag_id
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<FindTagsQueryResponse>(
        findTagQuery,
        findTagsQueryInput,
      );

    let tagId: string;
    let status = HttpStatus.OK;

    if (queryResponse.dionysus_content_tags.length > 0) {
      tagId = queryResponse.dionysus_content_tags[0].content_tag_id;

      const updateQuery = gql`
        mutation TagAssetOrIgnoreOnConflict(
          $content_tag_id: uuid
          $content_id: uuid
        ) {
          insert_dionysus_content_asset_tags(
            objects: {
              content_id: $content_id
              content_tag_id: $content_tag_id
            }
            on_conflict: {
              constraint: content_asset_tags_pkey
              update_columns: []
            }
          ) {
            affected_rows
          }
        }
      `;

      const updateResponse =
        await this.graphQLClient.request<UpdateQueryResponse>(updateQuery, {
          content_id: assetId,
          content_tag_id: tagId,
        });

      if (
        updateResponse.insert_dionysus_content_asset_tags.affected_rows <= 0
      ) {
        status = HttpStatus.NOT_MODIFIED;
      }
    } else {
      const insertQuery = gql`
        mutation CreateTagAndUpdateAsset(
          $content_id: uuid
          $type: String
          $name: String
        ) {
          insert_dionysus_content_tags(
            objects: {
              type: $type
              name: $name
              tagged_content: { data: { content_id: $content_id } }
            }
          ) {
            returning {
              content_tag_id
            }
          }
        }
      `;

      const insertResponse =
        await this.graphQLClient.request<InputQueryResponse>(insertQuery, {
          content_id: assetId,
          ...findTagsQueryInput,
        });

      tagId =
        insertResponse.insert_dionysus_content_tags.returning[0].content_tag_id;
    }

    response.status(status).send({});
  }
}
