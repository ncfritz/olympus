import { FilterDefinition, FilterType } from "@ncfritz/olympus-model";
import { type Request } from "express";

/** The cookie holding the content auth token (issued by VerifyAuthCode). */
export const CONTENT_AUTH_COOKIE = "x-dionysus-content-auth";

/** The content auth token carried by `request`, if any. */
export const contentAuthToken = (request: Request): string | undefined =>
  request.cookies[CONTENT_AUTH_COOKIE];

/** Assets a request without content auth may see. */
export const BC_FILTER: FilterDefinition = {
  type: FilterType.AND,
  name: "__bc_tag",
  value: [
    {
      type: FilterType.EQUALS,
      name: "asset_tags.tag.type",
      value: "system",
    },
    {
      type: FilterType.LIKE_IGNORE_CASE,
      name: "asset_tags.tag.name",
      value: "bcCompliant",
    },
  ],
};

/** Channels a request without content auth may see. */
export const BC_CHANNEL_FILTER: FilterDefinition = {
  type: FilterType.EQUALS,
  name: "bcCompliant",
  value: true,
};
