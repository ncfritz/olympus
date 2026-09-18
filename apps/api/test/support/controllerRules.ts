/**
 * The API conventions in docs/conventions/api.md, as checks over the
 * controller inventory. Each finding is keyed "<rule> <ControllerClass>".
 *
 *   route-count        exactly one route per controller
 *   handler-name       the route method is named `handle`
 *   version            @Controller({ version: "1" })
 *   response-object    the handler writes through @Res()
 *   operation-fields   operationId, summary, description and one tag
 *   class-name         class name is `<operationId>Controller`
 *   file-name          file name is `<operationId>.ts`
 *   operation-unique   operationId is unique across the API
 *   standard-errors    @ApiStandardErrorResponses() (400 and 404 documented)
 *   success-response   at least one 2xx response documented
 *   status-sent        every documented 2xx/304 status is sent somewhere
 *                      (in the controller or a base class it extends)
 *   registered         listed in an *ApiModule that is in an OpenAPI document
 *   summary-style      summary has no trailing period
 *   description-style  description is a sentence ending in a period
 *   tag-style          the tag is Title Case
 */
import * as path from "path";
import type { ControllerInfo } from "./controllers";

export type Finding = { rule: string; target: string; message: string };

const HTTP_STATUS: Record<string, number> = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  MULTI_STATUS: 207,
  NOT_MODIFIED: 304,
};

export function checkControllers(controllers: ControllerInfo[]): Finding[] {
  const findings: Finding[] = [];
  const operationOwners = new Map<string, string[]>();

  for (const c of controllers) {
    const report = (rule: string, message: string) =>
      findings.push({
        rule,
        target: c.className,
        message: `${c.file}: ${message}`,
      });

    if (c.routes.length !== 1) {
      report("route-count", `${c.routes.length} routes`);
    }
    if (c.version !== "1") report("version", `version ${String(c.version)}`);
    const route = c.routes[0];
    if (!route) continue;

    if (route.handlerName !== "handle") {
      report("handler-name", `route method is ${route.handlerName}`);
    }
    if (!route.usesResponseObject)
      report("response-object", "no @Res() parameter");

    const { operationId, summary, description, tags } = route.operation;
    const missing = [
      !operationId && "operationId",
      !summary && "summary",
      !description && "description",
      (!tags || tags.length !== 1) && "exactly one tag",
    ].filter(Boolean);
    if (missing.length)
      report("operation-fields", `missing ${missing.join(", ")}`);

    if (operationId) {
      operationOwners.set(operationId, [
        ...(operationOwners.get(operationId) ?? []),
        c.className,
      ]);
      if (c.className !== `${operationId}Controller`) {
        report(
          "class-name",
          `class ${c.className} for operation ${operationId}`,
        );
      }
      if (path.basename(c.file, ".ts") !== operationId) {
        report(
          "file-name",
          `file ${path.basename(c.file)} for operation ${operationId}`,
        );
      }
    }
    if (summary && /\.\s*$/.test(summary)) {
      report("summary-style", `summary ends with a period: "${summary}"`);
    }
    if (description && !/[.!?]\s*$/.test(description)) {
      report(
        "description-style",
        `description is not a sentence: "${description}"`,
      );
    }
    if (tags?.[0] && !/^[A-Z][A-Za-z]*( [A-Z][A-Za-z]*)*$/.test(tags[0])) {
      report("tag-style", `tag "${tags[0]}"`);
    }

    const codes = Object.keys(route.responses).map(Number);
    if (!codes.includes(400) || !codes.includes(404)) {
      report(
        "standard-errors",
        "400/404 not documented (@ApiStandardErrorResponses)",
      );
    }
    const success = codes.filter((s) => (s >= 200 && s < 300) || s === 304);
    if (!success.some((s) => s < 300)) {
      report("success-response", "no 2xx response documented");
    }
    const sent = new Set(
      [...c.sources.join("\n").matchAll(/HttpStatus\.([A-Z_]+)/g)]
        .map((m) => HTTP_STATUS[m[1]])
        .filter((s) => s !== undefined),
    );
    const neverSent = success.filter((s) => !sent.has(s));
    if (neverSent.length) {
      report(
        "status-sent",
        `documents ${neverSent.join(", ")} but sends ${[...sent].join(", ") || "nothing detectable"}`,
      );
    }

    if (c.documents.length === 0) {
      report("registered", "not in any *ApiModule of an OpenAPI document");
    }
  }

  for (const [operationId, owners] of operationOwners) {
    if (owners.length > 1) {
      for (const owner of owners) {
        findings.push({
          rule: "operation-unique",
          target: owner,
          message: `operationId ${operationId} also used by ${owners.filter((o) => o !== owner).join(", ")}`,
        });
      }
    }
  }
  return findings;
}
