import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";

export class Keyword {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, type: String })
  value: string;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialKeyword extends OmitType(Keyword, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class KeywordAssociation {
  @ApiProperty({ required: true, type: Keyword })
  keyword: Keyword;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ required: true, type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialKeywordAssociation extends OmitType(KeywordAssociation, [
  "createdTime",
  "lastUpdatedTime",
  "keyword",
]) {
  @ApiProperty({ required: true, type: Number })
  keywordId: number;
}

export class CreateKeywordRequest {
  @ApiProperty({
    required: true,
    type: () => PartialKeyword,
  })
  keyword: PartialKeyword;
}

export class CreateKeywordResponse {
  @ApiProperty({
    required: true,
    type: () => Keyword,
  })
  keyword: Keyword;
}

export class ListKeywordsResponse extends PaginatedResults {
  @ApiProperty({ required: true, type: () => Keyword, isArray: true })
  keywords: Keyword[];
}
