import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { PartialTypedImage, TypedImage } from "./common";
import { SparseMovie } from "./movies";

export class BaseCollection {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  overview: string;

  @ApiProperty({ type: String })
  posterPath: string;

  @ApiProperty({ type: String })
  backdropPath: string;
}

export class Collection extends BaseCollection {
  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: () => CollectionPart,
    isArray: true,
  })
  parts: CollectionPart[];

  @ApiProperty({
    type: () => TypedImage,
    isArray: true,
  })
  images: TypedImage[];
}

export class PartialCollection extends BaseCollection {
  @ApiProperty({
    type: () => PartialCollectionPart,
    isArray: true,
  })
  parts: PartialCollectionPart[];

  @ApiProperty({
    type: () => PartialTypedImage,
    isArray: true,
  })
  images: PartialTypedImage[];
}

export class CollectionPart {
  @ApiProperty({ type: SparseMovie })
  movie: SparseMovie;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialCollectionPart extends OmitType(CollectionPart, [
  "createdTime",
  "lastUpdatedTime",
  "movie",
]) {
  @ApiProperty({ type: Number })
  movieId: number;
}

export class CreateCollectionRequest {
  @ApiProperty({
    type: () => PartialCollection,
  })
  collection: PartialCollection;
}

export class CreateCollectionResponse {
  @ApiProperty({
    type: Number,
  })
  id: number;
}

export class DescribeCollectionResponse {
  @ApiProperty({
    type: () => Collection,
  })
  collection: Collection;
}
