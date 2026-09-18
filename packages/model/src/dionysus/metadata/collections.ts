import { AUDIT_FIELDS } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PartialTypedImage, TypedImage } from "./common";
import { SparseMovie } from "./movies";

export class BaseCollection {
  @ApiProperty({ required: true, type: Number })
  id: number;

  @ApiProperty({ required: true, type: String })
  name: string;

  @ApiProperty({ required: true, type: String })
  overview: string;

  @ApiProperty({ required: true, type: String })
  posterPath: string;

  @ApiProperty({ required: true, type: String })
  backdropPath: string;
}

export class Collection extends BaseCollection {
  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;

  @ApiProperty({
    required: true,
    type: () => CollectionPart,
    isArray: true,
  })
  parts: CollectionPart[];

  @ApiProperty({
    required: true,
    type: () => TypedImage,
    isArray: true,
  })
  images: TypedImage[];
}

export class PartialCollection extends BaseCollection {
  @ApiProperty({
    required: true,
    type: () => PartialCollectionPart,
    isArray: true,
  })
  parts: PartialCollectionPart[];

  @ApiProperty({
    required: true,
    type: () => PartialTypedImage,
    isArray: true,
  })
  images: PartialTypedImage[];
}

export class CollectionPart {
  @ApiProperty({ required: true, type: SparseMovie })
  movie: SparseMovie;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialCollectionPart extends OmitType(CollectionPart, [
  ...AUDIT_FIELDS,
  "movie",
]) {
  @ApiProperty({ required: true, type: Number })
  movieId: number;
}

export class CreateCollectionRequest {
  @ApiProperty({
    required: true,
    type: () => PartialCollection,
  })
  collection: PartialCollection;
}

export class CreateCollectionResponse {
  @ApiProperty({
    required: true,
    type: Number,
  })
  id: number;
}

export class DescribeCollectionResponse {
  @ApiProperty({
    required: true,
    type: () => Collection,
  })
  collection: Collection;
}
