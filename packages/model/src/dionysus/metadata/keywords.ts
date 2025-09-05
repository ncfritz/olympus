import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment/moment";
import { PaginatedResults } from "../../common";

export class Keyword {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  value: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialKeyword extends OmitType(Keyword, [
  "createdTime",
  "lastUpdatedTime",
]) {}

export class KeywordAssociation {
  @ApiProperty({ type: Keyword })
  keyword: Keyword;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;
}

export class PartialKeywordAssociation extends OmitType(KeywordAssociation, [
  "createdTime",
  "lastUpdatedTime",
  "keyword",
]) {
  @ApiProperty({ type: Number })
  keywordId: number;
}

export class CreateKeywordRequest {
  @ApiProperty({
    type: () => PartialKeyword,
  })
  keyword: PartialKeyword;
}

export class CreateKeywordResponse {
  @ApiProperty({
    type: () => Keyword,
  })
  keyword: Keyword;
}

export class ListKeywordsResponse extends PaginatedResults {
  @ApiProperty({ type: () => Keyword, isArray: true })
  keywords: Keyword[];
}
