import { AUDIT_FIELDS } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../../common";

export class Keyword {
  @ApiProperty({ required: true, type: String })
  id: string;

  @ApiProperty({ required: true, type: String })
  value: string;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialKeyword extends OmitType(Keyword, [...AUDIT_FIELDS]) {}

export class KeywordAssociation {
  @ApiProperty({ required: true, type: Keyword })
  keyword: Keyword;

  @ApiTimestamp({ required: true })
  createdTime: Moment;

  @ApiTimestamp({ required: true })
  lastUpdatedTime: Moment;
}

export class PartialKeywordAssociation extends OmitType(KeywordAssociation, [
  ...AUDIT_FIELDS,
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
