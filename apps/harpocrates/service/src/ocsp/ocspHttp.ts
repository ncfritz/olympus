/**
 * The OCSP responder's HTTP (ADR 0036; RFC 6960 A.1, RFC 5019): a GET's
 * request read from its path, and an answer sent as a cache should keep
 * it.
 */
import type { Response } from "express";
import type { OcspAnswer } from "./services/OcspAnswerService";

const PREFIX = "/ocsp/";

/** RFC 6960 A.1's GET: the request, base64, URL-encoded, after /ocsp/. */
export const fromPath = (originalUrl: string): Buffer => {
  const at = originalUrl.indexOf(PREFIX);
  const encoded = at < 0 ? "" : originalUrl.slice(at + PREFIX.length);
  let text: string;
  try {
    text = decodeURIComponent(encoded.split("?")[0]);
  } catch {
    text = "";
  }
  return Buffer.from(
    text.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, ""),
    "base64",
  );
};

/** As the RFC 5019 profile has a responder send it, cacheable while fresh. */
export const send = (response: Response, answer: OcspAnswer): void => {
  response.status(200).type("application/ocsp-response");
  if (answer.thisUpdate && answer.nextUpdate) {
    response.setHeader(
      "Cache-Control",
      `max-age=${answer.maxAge}, public, no-transform, must-revalidate`,
    );
    response.setHeader("Last-Modified", answer.thisUpdate.toUTCString());
    response.setHeader("Expires", answer.nextUpdate.toUTCString());
    if (answer.etag) response.setHeader("ETag", answer.etag);
  } else {
    response.setHeader("Cache-Control", "no-cache, no-store");
  }
  response.send(answer.body);
};
