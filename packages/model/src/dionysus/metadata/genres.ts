import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";

export enum GenreType {
  TV = "TV",
  MOVIE = "Movie",
}

export class Genre {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ enum: () => GenreType, enumName: "GenreType" })
  type: GenreType;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialGenre extends OmitType(Genre, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class GenreAssociation {
  @ApiProperty({ type: Genre })
  genre: Genre;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialGenreAssociation extends OmitType(GenreAssociation, [
  "createdTime",
  "lastUpdatedTime",
  "genre",
]) {
  @ApiProperty({ type: Number })
  genreId: number;
}

export class CreateGenreRequest {
  @ApiProperty({
    type: () => PartialGenre,
  })
  genre: PartialGenre;
}

export class CreateGenreResponse {
  @ApiProperty({
    type: () => Genre,
  })
  genre: Genre;
}

export class ListGenresResponse extends PaginatedResults {
  @ApiProperty({ type: () => Genre, isArray: true })
  genres: Genre[];
}
