/**
 * The API conventions in docs/conventions/api.md, as checks over the
 * agent's controller inventory (ADR 0016). Ported from
 * apps/api/test/support/controllerRules.ts; the GraphQL rules are dropped
 * (the agent has no Hasura), and the rules for provider callbacks and
 * access tokens are added. Each finding is keyed "<rule> <ControllerClass>".
 *
 * Every controller:
 *   route-count        exactly one route per controller
 *   handler-name       the route method is named `handle`
 *   file-name          the file is named after the class
 *   thin-controller    the controller injects services only (no stores,
 *                      Prisma, RabbitMQ or configuration)
 *   registered         reachable from AppModule
 *   feature-module     listed in the <Area>Module.ts beside its controllers/
 *                      folder (src/<area>/controllers/X.ts is registered by
 *                      src/<area>/<Area>Module.ts)
 *   route-shadow       no route registered earlier (a parameterised path such
 *                      as /events/:eventId) matches this route's path for the
 *                      same method; Express would send the request there
 *
 * Provider callbacks (@ApiExcludeController):
 *   callback-version   VERSION_NEUTRAL: the path is registered with the provider
 *   callback-public    @Public(): the provider has no access token
 *
 * Management operations (everything else):
 *   version            @Controller({ version: "1" })
 *   response-object    the handler writes through @Res()
 *   operation-fields   operationId, summary, description and one tag
 *   class-name         class name is `<operationId>Controller`
 *   operation-unique   operationId is unique
 *   summary-unique     no two operations share a summary (copy-paste guard)
 *   description-unique no two operations share a description
 *   summary-style      summary has no trailing period
 *   description-style  description is a sentence ending in a period
 *   tag-style          the tag is Title Case
 *   todo               summary or description still contains a TODO
 *   standard-errors    @ApiStandardErrorResponses()
 *   access-token       operations behind the access token have
 *                      @ApiBearerAuth() and document 401; @Public() ones
 *                      have no @ApiBearerAuth()
 *   success-response   at least one 2xx response documented
 *   status-sent        every documented 2xx status is sent
 *   location           Location is set with setLocation() (utils/location),
 *                      and documented on the 201 response exactly when set
 */
import * as fs from "fs";
import * as path from "path";
import { VERSION_NEUTRAL } from "@nestjs/common";
import { AGENT_ROOT, type ControllerInfo } from "./controllers";

export type Finding = { rule: string; target: string; message: string };

const HTTP_STATUS: Record<string, number> = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
};

/** Types a controller may not inject: that work belongs in a service. */
const NOT_IN_CONTROLLERS =
  /Store$|^PrismaService$|^AmqpConnection$|^ConfigService$/;

export function checkControllers(controllers: ControllerInfo[]): Finding[] {
  const findings: Finding[] = [];
  const operationOwners = new Map<string, string[]>();
  const summaryOwners = new Map<string, string[]>();
  const descriptionOwners = new Map<string, string[]>();
  const own = (map: Map<string, string[]>, key: string, owner: string) =>
    map.set(key, [...(map.get(key) ?? []), owner]);

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
    if (path.basename(c.file, ".ts") !== c.className) {
      report("file-name", `file ${path.basename(c.file)}`);
    }
    const injected = c.injects.filter((name) => NOT_IN_CONTROLLERS.test(name));
    if (injected.length) {
      report(
        "thin-controller",
        `injects ${injected.join(", ")}; move that to a service`,
      );
    }
    if (c.registrationIndex < 0) {
      report("registered", "not reachable from AppModule");
    }
    const areaDir = path.dirname(path.dirname(c.file));
    const areaModules = fs
      .readdirSync(path.join(AGENT_ROOT, areaDir))
      .filter((f) => /^[A-Z]\w*Module\.ts$/.test(f));
    const listed = areaModules.some((f) =>
      new RegExp(`\\b${c.className}\\b`).test(
        fs.readFileSync(path.join(AGENT_ROOT, areaDir, f), "utf8"),
      ),
    );
    if (!listed) {
      report(
        "feature-module",
        areaModules.length
          ? `not listed in ${areaModules.join(", ")} in ${areaDir}`
          : `no <Area>Module.ts in ${areaDir}`,
      );
    }

    const route = c.routes[0];
    if (!route) continue;
    if (route.handlerName !== "handle") {
      report("handler-name", `route method is ${route.handlerName}`);
    }

    if (c.excluded) {
      if (c.version !== VERSION_NEUTRAL) {
        report("callback-version", `version ${String(c.version)}`);
      }
      if (!c.public) report("callback-public", "no @Public()");
      continue;
    }

    if (c.version !== "1") report("version", `version ${String(c.version)}`);
    if (!route.usesResponseObject) {
      report("response-object", "no @Res() parameter");
    }

    const { operationId, summary, description, tags } = route.operation;
    const missing = [
      !operationId && "operationId",
      !summary && "summary",
      !description && "description",
      (!tags || tags.length !== 1) && "exactly one tag",
    ].filter(Boolean);
    if (missing.length) {
      report("operation-fields", `missing ${missing.join(", ")}`);
    }
    if (operationId) {
      own(operationOwners, operationId, c.className);
      if (c.className !== `${operationId}Controller`) {
        report(
          "class-name",
          `class ${c.className} for operation ${operationId}`,
        );
      }
    }
    if (summary) own(summaryOwners, summary, c.className);
    if (description) own(descriptionOwners, description, c.className);
    if (/\bTODO\b/.test(`${summary ?? ""} ${description ?? ""}`)) {
      report("todo", "summary or description still contains a TODO");
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

    if (!/@ApiStandardErrorResponses\(/.test(c.source)) {
      report("standard-errors", "no @ApiStandardErrorResponses()");
    }
    const codes = Object.keys(route.responses).map(Number);
    const bearer = /@ApiBearerAuth\(/.test(c.source);
    if (c.public && bearer) {
      report("access-token", "@Public() but documents @ApiBearerAuth()");
    }
    if (!c.public && (!bearer || !codes.includes(401))) {
      report("access-token", "needs @ApiBearerAuth() and a documented 401");
    }

    const success = codes.filter((s) => s >= 200 && s < 300);
    if (!success.length) {
      report("success-response", "no 2xx response documented");
    }
    const sent = new Set(
      [...c.source.matchAll(/HttpStatus\.([A-Z_]+)/g)]
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

    const setsLocation = /\bsetLocation\(/.test(c.source);
    const documentsLocation = Object.values(route.responses).some((response) =>
      Boolean(
        (response as { headers?: Record<string, unknown> }).headers?.Location,
      ),
    );
    if (
      /["'`]Location["'`]|\.location\(/.test(c.source) &&
      !/Location: \{/.test(c.source)
    ) {
      report("location", "sets Location by hand; use setLocation()");
    }
    if (setsLocation && !documentsLocation) {
      report("location", "sets Location but does not document it");
    }
    if (documentsLocation && !setsLocation) {
      report("location", "documents a Location header it never sets");
    }
  }

  // route-shadow: Express tries routes in registration order, so an earlier
  // parameterised route swallows a later static one with the same method.
  const prefix = (c: ControllerInfo) =>
    typeof c.version === "string" ? `/v${c.version}` : "";
  const normalize = (c: ControllerInfo, p: string) =>
    `${prefix(c)}/${p.replace(/^\/+|\/+$/g, "")}`;
  const matcher = (c: ControllerInfo, p: string) =>
    new RegExp(
      `^${normalize(c, p)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/:\w+/g, "[^/]+")}$`,
    );
  const registered = controllers
    .filter((c) => c.registrationIndex >= 0)
    .flatMap((c) => c.routes.map((r) => ({ c, r })));
  for (const later of registered) {
    for (const earlier of registered) {
      if (
        earlier.c !== later.c &&
        earlier.c.registrationIndex < later.c.registrationIndex &&
        earlier.r.method === later.r.method &&
        matcher(earlier.c, earlier.r.path).test(
          normalize(later.c, later.r.path),
        )
      ) {
        findings.push({
          rule: "route-shadow",
          target: later.c.className,
          message: `${later.c.file}: ${later.r.method} ${normalize(later.c, later.r.path)} is shadowed by ${earlier.c.className} (${normalize(earlier.c, earlier.r.path)}), registered earlier`,
        });
      }
    }
  }

  const duplicates = (
    map: Map<string, string[]>,
    rule: string,
    what: string,
  ) => {
    for (const [value, owners] of map) {
      if (owners.length < 2) continue;
      for (const owner of owners) {
        findings.push({
          rule,
          target: owner,
          message: `${what} "${value}" also used by ${owners.filter((o) => o !== owner).join(", ")}`,
        });
      }
    }
  };
  duplicates(operationOwners, "operation-unique", "operationId");
  duplicates(summaryOwners, "summary-unique", "summary");
  duplicates(descriptionOwners, "description-unique", "description");
  return findings;
}
