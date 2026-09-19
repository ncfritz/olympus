import type {
  BaseSearchResultTag,
  SearchResultTagType,
} from "@ncfritz/olympus-sdk/dionysus";
import { parseTitle } from "./detector";
import { evaluate } from "./tag/tagEvaluator";
import { TAGS } from "./tag/tags";
import type { QualityModel } from "./types";

export type ScoredRelease = {
  /** Quality, source, resolution, ... parsed from the title. */
  titleInfo: QualityModel;
  /** Every tag (custom format) the release matches. */
  tags: BaseSearchResultTag[];
  /** The sum of the tags' scores. */
  score: number;
};

/** Parses a release title and scores it against the tag definitions. */
export const scoreRelease = (title: string): ScoredRelease => {
  const titleInfo = parseTitle(title);
  const tags: BaseSearchResultTag[] = [];
  let score = 0;

  Object.entries(TAGS).forEach(([category, definitions]) => {
    definitions.forEach((definition) => {
      const result = evaluate(titleInfo, definition);

      if (result) {
        tags.push({
          type: category as SearchResultTagType,
          value: result.name,
          score: result.value,
        });
        score += result.value;
      }
    });
  });

  return { titleInfo, tags, score };
};
