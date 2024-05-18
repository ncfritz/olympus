import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  ContentAsset,
  ListDuplicateContentAssetsResponse,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { toDomainObject } from "../../convert/content/ContentAssetConverter";
import { GraphQLContentAsset } from "../../types/content";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlListDuplicateContentAssetsInput = {
  sha: string;
};

type GraphQlListDuplicateContentAssetsResponse = {
  dionysus_content_assets: GraphQLContentAsset[];
};

@Controller()
export class ListDuplicateContentAssetsController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Get("/v1/content/assets/duplicates")
  @ApiOperation({
    summary: "Lists duplicate content assets based on a SHA256 sum",
    description:
      "Lists duplicate content assets for a provided SHA256 sum.  This will check input against existing original" +
      "SHA256 sums and transcoded asset SHA256 sums.",
    operationId: "ListDuplicateContentAssets",
  })
  @ApiTags("Content")
  @ApiProduces("application/json")
  @ApiQuery({
    name: "digest",
    description: "The computed SHA256 sum to check",
    type: String,
  })
  @ApiOkResponse({
    description:
      "The list of assets.  If there are more jobs to list, a pagination token will be present.",
    type: () => ListDuplicateContentAssetsResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("digest") digest: string,
    @Res() response: Response,
  ): Promise<void> {
    const fetchRequest = gql`
      query ListDuplicateContentAssets($sha: String) {
        dionysus_content_assets(
          where: {
            _or: [{ asset_sha: { _eq: $sha } }, { original_sha: { _eq: $sha } }]
          }
        ) {
          content_id
          original_sha
          original_size
          asset_sha
          asset_size
          createdTime
          duration
          height
          name
          original_name
          rating
          width
          asset_tags {
            tag {
              content_tag_id
              name
              type
            }
          }
        }
      }
    `;

    const fetchResponse = await this.graphQLClient.request<
      GraphQlListDuplicateContentAssetsResponse,
      GraphQlListDuplicateContentAssetsInput
    >(fetchRequest, {
      sha: digest,
    });
    const fetchedAssets: ContentAsset[] = [];

    fetchResponse.dionysus_content_assets.forEach((result) => {
      fetchedAssets.push(toDomainObject(result));
    });

    const responseBody: ListDuplicateContentAssetsResponse = {
      assets: fetchedAssets,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
