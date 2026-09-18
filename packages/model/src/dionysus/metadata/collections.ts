import { AUDIT_FIELDS } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PartialTypedImage, TypedImage } from "./common";
import { SparseMovie } from "./movies";

export class BaseCollection {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the collection",
  })
  id: number;

  @ApiProperty({
    required: true,
    type: String,
    description: "The name of the collection",
  })
  name: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "A summary of the collection",
  })
  overview: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB path of the poster image",
  })
  posterPath: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB path of the backdrop image",
  })
  backdropPath: string;
}

export class Collection extends BaseCollection {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the collection was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the collection was last updated",
  })
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: () => CollectionPart,
    isArray: true,
    description: "The movies in the collection",
  })
  parts: CollectionPart[];

  @ApiProperty({
    required: true,
    type: () => TypedImage,
    isArray: true,
    description: "Images of the collection",
  })
  images: TypedImage[];
}

export class PartialCollection extends BaseCollection {
  @ApiProperty({
    required: true,
    type: () => PartialCollectionPart,
    isArray: true,
    description: "The movies in the collection",
  })
  parts: PartialCollectionPart[];

  @ApiProperty({
    required: true,
    type: () => PartialTypedImage,
    isArray: true,
    description: "Images of the collection",
  })
  images: PartialTypedImage[];
}

export class CollectionPart {
  @ApiProperty({ required: true, type: SparseMovie, description: "The movie" })
  movie: SparseMovie;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the collection part was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the collection part was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialCollectionPart extends OmitType(CollectionPart, [
  ...AUDIT_FIELDS,
  "movie",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the movie",
  })
  movieId: number;
}

export class CreateCollectionRequest {
  @ApiProperty({
    required: true,
    type: () => PartialCollection,
    description: "The collection to create",
  })
  collection: PartialCollection;
}

export class CreateCollectionResponse {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the created collection",
  })
  id: number;
}

export class DescribeCollectionResponse {
  @ApiProperty({
    required: true,
    type: () => Collection,
    description: "The requested collection",
  })
  collection: Collection;
}
