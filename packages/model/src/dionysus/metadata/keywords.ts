import { AUDIT_FIELDS, PaginatedResults } from "../../common";
import { ApiTimestamp } from "../../decorators";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import type { Moment } from "moment";

export class Keyword {
  @ApiProperty({
    required: true,
    type: String,
    description: "The TMDB ID of the keyword",
  })
  id: string;

  @ApiProperty({
    required: true,
    type: String,
    description: "The keyword text",
  })
  value: string;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the keyword was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the keyword was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialKeyword extends OmitType(Keyword, [...AUDIT_FIELDS]) {}

export class KeywordAssociation {
  @ApiProperty({
    required: true,
    type: Keyword,
    description: "The associated keyword",
  })
  keyword: Keyword;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the keyword association was created",
  })
  createdTime: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the keyword association was last updated",
  })
  lastUpdatedTime: Moment;
}

export class PartialKeywordAssociation extends OmitType(KeywordAssociation, [
  ...AUDIT_FIELDS,
  "keyword",
]) {
  @ApiProperty({
    required: true,
    type: Number,
    description: "The TMDB ID of the keyword",
  })
  keywordId: number;
}

export class CreateKeywordRequest {
  @ApiProperty({
    required: true,
    type: () => PartialKeyword,
    description: "The keyword to create",
  })
  keyword: PartialKeyword;
}

export class CreateKeywordResponse {
  @ApiProperty({
    required: true,
    type: () => Keyword,
    description: "The created keyword",
  })
  keyword: Keyword;
}

export class ListKeywordsResponse extends PaginatedResults {
  @ApiProperty({
    required: true,
    type: () => Keyword,
    isArray: true,
    description: "The keywords on the requested page",
  })
  keywords: Keyword[];
}
