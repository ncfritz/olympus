import {
  Collection,
  PartialCollection,
  PartialCollectionPart,
  PartialTypedImage,
} from "@ncfritz/olympus-model";
import { Injectable, NotFoundException } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlCollection } from "../../types/metadata";
import { toDomainObject } from "../converters/CollectionConverter";

type GraphQlCreateCollectionInput = {
  id: number;
  name: string;
  overview: string;
  posterPath: string;
  backdropPath: string;
  parts: PartialCollectionPart[];
  images: PartialTypedImage[];
};

type GraphQlCreateCollectionResponse = {
  insert_dionysus_collections_one: {
    id: number;
  };
};

type GraphQlGetCollectionResponse = {
  dionysus_collections_by_pk: GraphQlCollection;
};

/** Movie collections in Hasura. */
@Injectable()
export class CollectionService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a collection; returns its ID. */
  async create(collection: PartialCollection): Promise<number> {
    const insertRequest = gql`
      mutation CreateCollection(
        $id: numeric!
        $name: String!
        $overview: String!
        $posterPath: String
        $backdropPath: String
        $parts: [dionysus_collection_parts_insert_input!]!
        $images: [dionysus_collection_images_insert_input!]!
      ) {
        insert_dionysus_collections_one(
          object: {
            id: $id
            name: $name
            overview: $overview
            posterPath: $posterPath
            backdropPath: $backdropPath
            parts: {
              on_conflict: {
                constraint: collection_parts_pkey
                update_columns: [movieId]
              }
              data: $parts
            }
            images: {
              on_conflict: {
                constraint: collection_images_pkey
                update_columns: [width, height, languageCode]
              }
              data: $images
            }
          }
          on_conflict: {
            constraint: collections_pkey
            update_columns: [name, overview, posterPath, backdropPath]
          }
        ) {
          id
        }
      }
    `;

    const insertResponse = await this.graphQLClient.request<
      GraphQlCreateCollectionResponse,
      GraphQlCreateCollectionInput
    >(insertRequest, {
      id: collection.id,
      name: collection.name,
      overview: collection.overview,
      posterPath: collection.posterPath,
      backdropPath: collection.backdropPath,
      parts: collection.parts,
      images: collection.images,
    });

    return insertResponse.insert_dionysus_collections_one.id;
  }

  /** @throws NotFoundException */
  async describe(collectionId: number): Promise<Collection> {
    const fetchRequest = gql`
      query DescribeCollection($id: numeric!) {
        dionysus_collections_by_pk(id: $id) {
          backdropPath
          createdTime
          id
          images {
            createdTime
            filePath
            height
            language {
              id
              createdTime
              lastUpdatedTime
              name
              nativeName
            }
            lastUpdatedTime
            type
            width
          }
          lastUpdatedTime
          name
          overview
          parts {
            createdTime
            lastUpdatedTime
            movie {
              adult
              backdropPath
              budget
              createdTime
              homepage
              id
              imdbId
              lastUpdatedTime
              originalLanguageCode
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
            }
          }
          posterPath
        }
      }
    `;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlGetCollectionResponse>(
        fetchRequest,
        {
          id: collectionId,
        },
      );

    if (!fetchResponse.dionysus_collections_by_pk) {
      throw new NotFoundException();
    }

    return toDomainObject(fetchResponse.dionysus_collections_by_pk);
  }
}
