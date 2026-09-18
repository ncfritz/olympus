import { ApiTimestamp } from "../../decorators";
import { ApiProperty } from "@nestjs/swagger";
import type { Moment } from "moment";
import { PaginatedResults } from "../../common";
import { MediaAssetWorkflowDecoration } from "./mediaWorkflow";

export class BaseMediaFavorite {
  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the search result was created",
  })
  createdTime: Moment;
}

export class SparseMediaFavorite extends BaseMediaFavorite {}

export class MediaFavorite extends SparseMediaFavorite {
  @ApiProperty({
    type: () => MediaAssetWorkflowDecoration,
    required: true,
    description: "Decoration details used for list items display",
  })
  decoration: MediaAssetWorkflowDecoration;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleMediaFavoriteResponse {
  @ApiProperty({
    type: () => MediaFavorite,
    required: true,
    description: "A media favorite that has been created, updated, or queried",
  })
  favorite: MediaFavorite;
}

export class ListMediaFavoritesResponse extends PaginatedResults {
  @ApiProperty({
    type: () => MediaFavorite,
    isArray: true,
    required: true,
    description: "A list of favorite media items",
  })
  favorites: MediaFavorite[];
}
