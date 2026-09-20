/**
 * Inventory of every controller (every file in a `controllers/` folder under
 * src), with the metadata the convention checks need. Ported from
 * apps/api/test/support/controllers.ts: the agent has one OpenAPI document,
 * built from AppModule, so registration order is AppModule's import graph.
 * Loading the files only evaluates decorators; no Nest application is
 * created.
 */
import type { DynamicModule, Type } from "@nestjs/common";
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
  VERSION_METADATA,
} from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common/enums/request-method.enum";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum";
import { DECORATORS } from "@nestjs/swagger";
import * as fs from "fs";
import * as path from "path";
import { AppModule } from "../../src/AppModule";
import { IS_PUBLIC_KEY } from "../../src/auth/public";

export type ApiOperationMetadata = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
};

export type RouteInfo = {
  method: string;
  handlerName: string;
  path: string;
  operation: ApiOperationMetadata;
  responses: Record<string, unknown>;
  usesResponseObject: boolean;
};

export type ControllerInfo = {
  className: string;
  /** Path relative to the agent, e.g. src/calendars/controllers/ListCalendarsController.ts */
  file: string;
  source: string;
  version: unknown;
  /** Excluded from the API document: a provider callback (ADR 0016). */
  excluded: boolean;
  /** Marked @Public() (no access token), on the class or the route. */
  public: boolean;
  /** Names of the constructor's injected types. */
  injects: string[];
  routes: RouteInfo[];
  /**
   * Position in which Nest registers the controller's routes: modules in
   * AppModule's import order (depth first), then each module's controllers
   * in the order listed. -1 when it is not registered.
   */
  registrationIndex: number;
};

export const AGENT_ROOT = path.resolve(__dirname, "../..");

const SOURCE_ROOT = path.join(AGENT_ROOT, "src");

/** Every .ts file in a `controllers` folder under `dir`. */
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return path.basename(dir) === "controllers" && entry.name.endsWith(".ts")
      ? [full]
      : [];
  });

/** Absolute file path -> module exports, for every controller file. */
const loadFiles = async (): Promise<Record<string, Record<string, unknown>>> =>
  Object.fromEntries(
    await Promise.all(
      walk(SOURCE_ROOT).map(
        async (file) =>
          [file, (await import(file)) as Record<string, unknown>] as const,
      ),
    ),
  );

const isRoute = (target: object, name: string) =>
  Reflect.getMetadata(
    METHOD_METADATA,
    (target as Record<string, object>)[name],
  ) !== undefined;

type ModuleRef =
  | Type<unknown>
  | DynamicModule
  | Promise<DynamicModule>
  | { forwardRef: () => ModuleRef };

/** Controllers in the order Nest scans modules: depth first from AppModule. */
const registrationOrder = (): Type<unknown>[] => {
  const seen = new Set<unknown>();
  const order: Type<unknown>[] = [];
  const visit = (ref: ModuleRef | undefined) => {
    if (!ref || ref instanceof Promise) return;
    if ("forwardRef" in ref) return visit(ref.forwardRef());
    const dynamic = "module" in ref ? ref : undefined;
    const cls = dynamic ? dynamic.module : (ref as Type<unknown>);
    if (seen.has(cls)) return;
    seen.add(cls);
    order.push(
      ...((Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, cls) ??
        []) as Type<unknown>[]),
      ...((dynamic?.controllers ?? []) as Type<unknown>[]),
    );
    for (const imported of [
      ...((Reflect.getMetadata(MODULE_METADATA.IMPORTS, cls) ??
        []) as ModuleRef[]),
      ...((dynamic?.imports ?? []) as ModuleRef[]),
    ]) {
      visit(imported);
    }
  };
  visit(AppModule);
  return order;
};

const registrationIndex = new Map<Type<unknown>, number>(
  registrationOrder().map((cls, index) => [cls, index] as const),
);

/** Loads every controller file and reads its metadata. */
export const loadControllers = async (): Promise<ControllerInfo[]> =>
  Object.entries(await loadFiles())
    .flatMap(([absolute, exports]) => {
      const file = path
        .relative(AGENT_ROOT, absolute)
        .split(path.sep)
        .join("/");
      const source = fs.readFileSync(absolute, "utf8");
      return Object.values(exports)
        .filter(
          (value): value is Type<unknown> =>
            typeof value === "function" &&
            Reflect.getMetadata(PATH_METADATA, value) !== undefined,
        )
        .map((cls) => {
          const proto = cls.prototype as Record<string, object>;
          const routes = Object.getOwnPropertyNames(proto)
            .filter(
              (n) =>
                n !== "constructor" &&
                typeof proto[n] === "function" &&
                isRoute(proto, n),
            )
            .map((handlerName): RouteInfo => {
              const handler = proto[handlerName];
              const args = (Reflect.getMetadata(
                ROUTE_ARGS_METADATA,
                cls,
                handlerName,
              ) ?? {}) as Record<string, unknown>;
              return {
                handlerName,
                method:
                  RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)],
                path: Reflect.getMetadata(PATH_METADATA, handler),
                operation:
                  Reflect.getMetadata(DECORATORS.API_OPERATION, handler) ?? {},
                responses:
                  Reflect.getMetadata(DECORATORS.API_RESPONSE, handler) ?? {},
                usesResponseObject: Object.keys(args).some((k) =>
                  k.startsWith(`${RouteParamtypes.RESPONSE}:`),
                ),
              };
            });
          const handler = routes[0] && proto[routes[0].handlerName];
          return {
            className: cls.name,
            file,
            source,
            version: Reflect.getMetadata(VERSION_METADATA, cls),
            excluded:
              Reflect.getMetadata(
                DECORATORS.API_EXCLUDE_CONTROLLER,
                cls,
              )?.[0] === true,
            public:
              Reflect.getMetadata(IS_PUBLIC_KEY, cls) === true ||
              (handler !== undefined &&
                Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true),
            injects: (
              (Reflect.getMetadata("design:paramtypes", cls) ?? []) as {
                name?: string;
              }[]
            ).map((t) => t?.name ?? "unknown"),
            routes,
            registrationIndex: registrationIndex.get(cls) ?? -1,
          };
        });
    })
    .sort((a, b) => a.className.localeCompare(b.className));
