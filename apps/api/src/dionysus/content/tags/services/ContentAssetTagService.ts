import { BaseContentAssetTag, ContentAssetTag } from "@ncfritz/olympus-model";
import { ConflictException, Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlContentAssetTag } from "../../types/content";
import { toDomainObject } from "../converters/ContentAssetTagConverter";
import { CONTENT_TAG } from "../../queries/tags";

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

type GraphQLCreateContentAssetResponse = {
  insert_dionysus_content_tags_one: GraphQlContentAssetTag;
};

type GraphQListContentAssetTagsResponse = {
  dionysus_content_tags: GraphQlContentAssetTag[];
};

type GraphQLListContentAssetTagsInput = {
  contentId: string;
};

type GraphQLListContentAssetTagsResponse = {
  dionysus_content_tags: GraphQlContentAssetTag[];
};

/** Content asset tags in Hasura, and the tags on each asset. */
@Injectable()
export class ContentAssetTagService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * Tags, optionally only those not on `assetId`, of `type`, or whose name
   * contains `name` (case-insensitive).
   */
  async listAvailable(
    assetId: string | undefined,
    type: string | undefined,
    name: string | undefined,
  ): Promise<ContentAssetTag[]> {
    const queryPlaceholders = [];
    const queryFilters = [];
    const queryVariables: Record<string, string> = {};

    if (assetId) {
      queryPlaceholders.push("$contentId: uuid!");
      queryVariables.contentId = assetId;
      queryFilters.push(
        "_not: { tagged_content: { content_id: { _eq: $contentId } } }",
      );
    }

    if (type) {
      queryPlaceholders.push("$type: String");
      queryVariables.type = type;
      queryFilters.push("type: { _eq: $type }");
    }

    if (name) {
      queryPlaceholders.push("$name: String");
      queryVariables.name = `%${name}%`;
      queryFilters.push("name: { _ilike: $name }");
    }

    const placeholders =
      queryPlaceholders.length > 0 ? `(${queryPlaceholders.join("\n")})` : "";
    let whereClause = "";

    if (queryFilters.length > 0) {
      whereClause =
        queryFilters.length > 1
          ? `(where: { _and: {${queryFilters.join("\n")}}})`
          : `(where: {${queryFilters[0]}})`;
    }
    const queryRequest = gql`
      query ListContentAssetTags${placeholders} {
        dionysus_content_tags${whereClause} {
          ${CONTENT_TAG}
        }
      }
    `;

    const queryResponse = await this.graphQLClient.request<
      GraphQListContentAssetTagsResponse,
      Record<string, string>
    >(queryRequest, queryVariables);

    const tags: ContentAssetTag[] = [];

    queryResponse.dionysus_content_tags.forEach((responseTag) => {
      tags.push(toDomainObject(responseTag));
    });

    return tags;
  }

  /** The tags on an asset. */
  async listForAsset(assetId: string): Promise<ContentAssetTag[]> {
    const queryRequest = gql`
      query ListContentAssetTagsForAsset($contentId: uuid!) {
        dionysus_content_tags(
          where: { tagged_content: { content_id: { _eq: $contentId } } }
        ) {
          ${CONTENT_TAG}
        }
      }
    `;

    const queryResponse = await this.graphQLClient.request<
      GraphQLListContentAssetTagsResponse,
      GraphQLListContentAssetTagsInput
    >(queryRequest, {
      contentId: assetId,
    });

    const tags: ContentAssetTag[] = [];

    queryResponse.dionysus_content_tags.forEach((responseTag) => {
      tags.push(toDomainObject(responseTag));
    });

    return tags;
  }

  /** @throws ConflictException when a tag of that type and name exists */
  async create(tag: BaseContentAssetTag): Promise<ContentAssetTag> {
    const insertRequest = gql`
      mutation CreateTag($type: String, $name: String) {
        insert_dionysus_content_tags_one(
          object: { name: $name, type: $type }
          on_conflict: { constraint: content_tags_name_type_key }
        ) {
          ${CONTENT_TAG}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQLCreateContentAssetResponse>(
        insertRequest,
        {
          name: tag.name,
          type: tag.type,
        },
      );

    if (!insertResponse.insert_dionysus_content_tags_one) {
      throw new ConflictException(
        "An existing tag with the specified tye and name already exists",
      );
    }

    return toDomainObject(insertResponse.insert_dionysus_content_tags_one);
  }

  /**
   * Tags an asset, creating the tag when no tag of that type and name
   * (case-insensitive) exists. Returns false when the asset already had it.
   */
  async addToAsset(
    assetId: string,
    tag: BaseContentAssetTag,
  ): Promise<boolean> {
    const findTagsQueryInput = {
      name: tag.name,
      type: tag.type,
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
        return false;
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

      await this.graphQLClient.request<InputQueryResponse>(insertQuery, {
        content_id: assetId,
        ...findTagsQueryInput,
      });
    }

    return true;
  }

  /** Removes a tag from an asset (a no-op when the asset does not have it). */
  async removeFromAsset(assetId: string, tagId: string): Promise<void> {
    const updateRequest = gql`
      mutation RemoveContentAssetTag($content_id: uuid, $content_tag_id: uuid) {
        delete_dionysus_content_asset_tags(
          where: {
            _and: {
              content_id: { _eq: $content_id }
              content_tag_id: { _eq: $content_tag_id }
            }
          }
        ) {
          affected_rows
        }
      }
    `;

    await this.graphQLClient.request(updateRequest, {
      content_id: assetId,
      content_tag_id: tagId,
    });
  }
}
