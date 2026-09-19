/**
 * Inventory of every controller (every file in a `controllers/` folder under
 * src, e.g. src/minerva/notes/controllers), with the metadata the
 * convention checks need. Loading the files only evaluates decorators; no
 * Nest application is created.
 */
import type { Type } from "@nestjs/common";
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
import {
  DionysusApiConfig,
  MinervaApiConfig,
  OlympusApiConfig,
} from "../../src/schema/schemas";

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
  /** Path relative to apps/api, e.g. src/minerva/notes/controllers/CreateNoteController.ts */
  file: string;
  /** Source of the controller file and of any base classes it extends. */
  sources: string[];
  version: unknown;
  routes: RouteInfo[];
  /** Name of the OpenAPI document (Olympus, Dionysus, Minerva) it appears in. */
  documents: string[];
  /**
   * Position in which Nest registers the controller's routes within its
   * document: feature modules in document order, then each module's
   * controllers in the order listed. -1 when it is not registered.
   */
  registrationIndex: number;
};

const API_ROOT = path.resolve(__dirname, "../..");

const SOURCE_ROOT = path.join(API_ROOT, "src");

/** Every non-spec .ts file in a `controllers` folder under `dir`. */
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return path.basename(dir) === "controllers" &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".spec.ts")
      ? [full]
      : [];
  });

/** Absolute file path -> module exports, for every controller file. */
const files: Record<string, Record<string, unknown>> = Object.fromEntries(
  await Promise.all(
    walk(SOURCE_ROOT).map(async (file) => [file, await import(file)] as const),
  ),
);

const isRoute = (target: object, name: string) =>
  Reflect.getMetadata(
    METHOD_METADATA,
    (target as Record<string, object>)[name],
  ) !== undefined;

const DOCUMENT_CONFIGS = [
  OlympusApiConfig,
  DionysusApiConfig,
  MinervaApiConfig,
];

/** Controller -> registration position within its document. */
const registrationIndex = new Map<Type<unknown>, number>(
  DOCUMENT_CONFIGS.flatMap((config) =>
    config.modules
      .flatMap(
        (module) =>
          (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ??
            []) as Type<unknown>[],
      )
      .map((cls, index) => [cls, index] as const),
  ),
);

const documentsFor = (cls: Type<unknown>): string[] =>
  DOCUMENT_CONFIGS.filter((config) =>
    config.modules.some((module) =>
      (
        (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ??
          []) as Type<unknown>[]
      ).includes(cls),
    ),
  ).map((config) => config.name);

const sourceOf = (file: string) => fs.readFileSync(file, "utf8");

/** Class name -> source file, for every class exported from a controller file. */
const classFiles = new Map<string, string>(
  Object.entries(files).flatMap(([file, exports]) =>
    Object.values(exports)
      .filter((v) => typeof v === "function")
      .map((v) => [(v as Type<unknown>).name, file] as [string, string]),
  ),
);

/** The controller's own source plus the sources of its base classes. */
const sourcesFor = (cls: Type<unknown>): string[] => {
  const result: string[] = [];
  for (
    let c: unknown = cls;
    typeof c === "function" && c !== Function.prototype;
    c = Object.getPrototypeOf(c)
  ) {
    const file = classFiles.get((c as Type<unknown>).name);
    if (file) result.push(sourceOf(file));
  }
  return result;
};

export const controllers: ControllerInfo[] = Object.entries(files)
  .flatMap(([absolute, exports]) => {
    const file = path.relative(API_ROOT, absolute).split(path.sep).join("/");
    return Object.values(exports)
      .filter(
        (value): value is Type<unknown> =>
          typeof value === "function" &&
          Reflect.getMetadata(PATH_METADATA, value) !== undefined,
      )
      .map((cls) => {
        const proto = cls.prototype as Record<string, object>;
        const names = new Set<string>();
        for (
          let p = proto;
          p && p !== Object.prototype;
          p = Object.getPrototypeOf(p)
        ) {
          Object.getOwnPropertyNames(p).forEach((n) => names.add(n));
        }
        const routes = [...names]
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
        return {
          className: cls.name,
          file,
          sources: sourcesFor(cls),
          version: Reflect.getMetadata(VERSION_METADATA, cls),
          routes,
          documents: documentsFor(cls),
          registrationIndex: registrationIndex.get(cls) ?? -1,
        };
      });
  })
  .sort((a, b) => a.className.localeCompare(b.className));

export type SourceInfo = {
  /** File name without extension, e.g. NoteService. */
  owner: string;
  /** Path relative to apps/api. */
  file: string;
  source: string;
};

/** Every non-spec source file under src that is not a controller file. */
export const otherSources: SourceInfo[] = (() => {
  const all = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return all(full);
      return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
        ? [full]
        : [];
    });
  return all(SOURCE_ROOT)
    .filter((file) => !(file in files))
    .map((file) => ({
      owner: path.basename(file, ".ts"),
      file: path.relative(API_ROOT, file).split(path.sep).join("/"),
      source: sourceOf(file),
    }));
})();
