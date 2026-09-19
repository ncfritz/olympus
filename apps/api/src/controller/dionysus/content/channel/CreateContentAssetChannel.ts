import {
  FullContentAssetChannel,
  CreateContentAssetChannelRequest,
  CreateContentAssetChannelResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { toFullDomainObject } from "../../../../convert/dionysus/content/channel/ContentAssetChannelConverter";
import { GraphQlFullContentAssetChannel } from "../../../../types/content";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseContentAssetChannelController } from "./BaseContentAssetChannelController";
import { DescribeContentAssetChannelController } from "./DescribeContentAssetChannel";
import { setLocation } from "../../../../utils/location";

export type GraphQlMutateContentAssetChannelResponse = {
  insert_dionysus_content_asset_channel_one: GraphQlFullContentAssetChannel;
};

@Controller({ version: "1" })
export class CreateContentAssetChannelController extends BaseContentAssetChannelController {
  constructor(protected readonly graphQLClient: GraphQLClient) {
    super(graphQLClient);
  }

  @Post("/content/channels")
  @ApiOperation({
    summary: "Creates a new content asset channel",
    description: "Creates a new content asset channel.",
    operationId: "CreateContentAssetChannel",
    tags: ["Content"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateContentAssetChannelRequest,
    required: true,
    description: "Input for the CreateBatchJob operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: CreateContentAssetChannelResponse,
    headers: {
      Location: {
        schema: { type: "string" },
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateContentAssetChannelRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const assetCache = await this.buildAssetCacheEntries(
      request.channel.filterDefinition,
    );

    const insertRequest = gql`
      mutation CreateContentAssetChannel(
        $name: String!
        $description: String!
        $bcCompliant: Boolean!
        $categoryId: uuid!
        $filterInput: String!
        $encodedFilter: String!
        $ttl: numeric
        $jitter: numeric
        $lastFetchedTime: timestamptz!
        $assetCount: numeric
        $assetCache: [dionysus_content_asset_channel_cache_insert_input!]!
      ) {
        insert_dionysus_content_asset_channel_one(
          object: {
            name: $name
            description: $description
            bcCompliant: $bcCompliant
            categoryId: $categoryId
            filterInput: $filterInput
            encodedFilter: $encodedFilter
            ttl: $ttl
            jitter: $jitter
            lastFetchedTime: $lastFetchedTime
            assetCount: $assetCount
            assetCache: { data: $assetCache }
          }
        ) {
          ttl
          name
          lastUpdatedTime
          lastFetchedTime
          jitter
          id
          filterInput
          favorite
          encodedFilter
          description
          createdTime
          category {
            createdTime
            id
            lastUpdatedTime
            name
            channels_aggregate {
              aggregate {
                count
              }
            }
          }
          bcCompliant
          assetCount
          assetCache {
            assetId
            width
            height
            createdTime
          }
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlMutateContentAssetChannelResponse>(
        insertRequest,
        {
          name: request.channel.name,
          description: request.channel.description,
          bcCompliant: request.channel.bcCompliant,
          categoryId: request.channel.categoryId,
          filterInput: request.channel.filterInput,
          encodedFilter: Buffer.from(
            JSON.stringify(request.channel.filterDefinition),
          ).toString("base64"),
          ttl: 7, // one week
          jitter: Math.floor(Math.random() * (24 * 60 - 4 * 60 + 1)) + 4 * 60,
          lastFetchedTime: moment.utc().toISOString(),
          assetCache: assetCache.entries,
          assetCount: assetCache.assetCount,
        },
      );

    const createdCategory: FullContentAssetChannel = toFullDomainObject(
      insertResponse.insert_dionysus_content_asset_channel_one,
    );

    const responseBody: CreateContentAssetChannelResponse = {
      channel: createdCategory,
    };

    setLocation(response, httpRequest, DescribeContentAssetChannelController, {
      channelId: createdCategory.id,
    });

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
