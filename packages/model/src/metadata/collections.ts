import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";
import { Country } from "./countries";
import { Movie } from "./movies";

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
    type: () => CollectionImage,
    isArray: true,
  })
  images: CollectionImage[];
}

export class PartialCollection extends BaseCollection {
  @ApiProperty({
    type: () => PartialCollectionPart,
    isArray: true,
  })
  parts: PartialCollectionPart[];

  @ApiProperty({
    type: () => PartialCollectionImage,
    isArray: true,
  })
  images: PartialCollectionImage[];
}

export class CollectionPart {
  @ApiProperty({ type: Movie })
  movie: Movie;

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
  @ApiProperty({ type: String })
  movieId: number;
}

export class CollectionImage {
  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: String })
  filePath: string;

  @ApiProperty({ type: Number })
  width: number;

  @ApiProperty({ type: Number })
  height: number;

  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialCollectionImage extends OmitType(CollectionImage, [
  "createdTime",
  "lastUpdatedTime",
  "country",
]) {
  @ApiProperty({ type: String })
  countryCode: string;
}

export class CreateCollectionRequest {
  @ApiProperty({
    type: () => PartialCollection,
  })
  collection: PartialCollection;
}

export class CreateCollectionResponse {
  @ApiProperty({
    type: () => Collection,
  })
  collection: Collection;
}
