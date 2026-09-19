/**
 * `Location` headers for created resources (docs/conventions/api.md,
 * "Created resources").
 *
 * The URL is built from the target controller's own route metadata, so it
 * always names a real GET route:
 *
 *   setLocation(response, request, DescribeNoteController, { noteId: id })
 *   // -> /v1/minerva/note/<id>, or /api/v1/minerva/note/<id> behind nginx
 *
 * The domain segment (`/minerva`) is taken from the create request, since a
 * created resource always lives in the same domain as the operation that
 * created it. A reverse proxy that mounts the API under a prefix says so
 * with `X-Forwarded-Prefix` (nginx: `proxy_set_header X-Forwarded-Prefix /api;`).
 */
import { RequestMethod, type Type } from "@nestjs/common";
import {
  METHOD_METADATA,
  PATH_METADATA,
  VERSION_METADATA,
} from "@nestjs/common/constants";
import type { Request, Response } from "express";

type RouteParams = Record<string, string | number>;

// A prefix is one or more path segments; anything else is ignored rather
// than echoed into a response header.
const PREFIX_PATTERN = /^(\/[A-Za-z0-9._~-]+)+$/;

const forwardedPrefix = (request: Request): string => {
  const header = request.headers["x-forwarded-prefix"];
  const value = (Array.isArray(header) ? header[0] : header)?.replace(
    /\/+$/,
    "",
  );
  return value && PREFIX_PATTERN.test(value) ? value : "";
};

/** Path of `target`'s GET route for `params`, as seen by this request's caller. */
export const locationOf = (
  request: Request,
  target: Type<unknown>,
  params: RouteParams,
): string => {
  const handler = (target.prototype as { handle?: unknown }).handle;
  if (
    typeof handler !== "function" ||
    Reflect.getMetadata(METHOD_METADATA, handler) !== RequestMethod.GET
  ) {
    throw new Error(`${target.name} is not a GET operation`);
  }

  const template = String(Reflect.getMetadata(PATH_METADATA, handler));
  const used = new Set<string>();
  const path = template.replace(/:(\w+)/g, (_, name: string) => {
    if (!(name in params)) {
      throw new Error(`${target.name} needs route parameter "${name}"`);
    }
    used.add(name);
    return encodeURIComponent(String(params[name]));
  });
  const unused = Object.keys(params).filter((name) => !used.has(name));
  if (unused.length > 0) {
    throw new Error(
      `${target.name} has no route parameter ${unused.map((n) => `"${n}"`).join(", ")}`,
    );
  }

  // /v1/<domain>/... -> <domain>
  const domain = request.path.split("/")[2];
  const version = Reflect.getMetadata(VERSION_METADATA, target);

  return `${forwardedPrefix(request)}/v${version}/${domain}${path.startsWith("/") ? "" : "/"}${path}`;
};

/** Sets `Location` to `target`'s GET route for `params`. */
export const setLocation = (
  response: Response,
  request: Request,
  target: Type<unknown>,
  params: RouteParams,
): Response =>
  response.setHeader("Location", locationOf(request, target, params));
