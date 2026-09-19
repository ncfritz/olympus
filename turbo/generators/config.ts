/**
 * `pnpm gen api-operation`: scaffolds one API operation following
 * docs/conventions/api.md. See docs/guides/api-operation-generator.md.
 */
import type { PlopTypes } from "@turbo/gen";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const VERBS = [
  "Describe",
  "List",
  "Create",
  "Update",
  "Delete",
  "Get",
] as const;
type Verb = (typeof VERBS)[number];

type Answers = {
  domain: "olympus" | "dionysus" | "minerva";
  area: string;
  module: string;
  verb: Verb;
  entity: string;
  entityPlural: string;
  operationId: string;
  route: string;
  tag: string;
  hasuraTable: string;
  idType: "uuid" | "String" | "Int";
  modelFile: string;
  bodyType: string;
  paginated: boolean;
};

const pascal = (s: string) =>
  s.replace(/(^|[-_\s/]+)(\w)/g, (_, __, c: string) => c.toUpperCase());
const camel = (s: string) => {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};
const plural = (s: string) =>
  /(s|x|z|ch|sh)$/.test(s)
    ? `${s}es`
    : /[^aeiou]y$/.test(s)
      ? `${s.slice(0, -1)}ies`
      : `${s}s`;
const words = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

/** The <Area>Module in a feature folder, if the folder has one. */
const existingModule = (dir: string): string | undefined =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .find((f) => /^[A-Z]\w*Module\.ts$/.test(f))
        ?.replace(/\.ts$/, "")
    : undefined;

/**
 * Adds `names` to the import from `from`, or a new import after the last
 * one. Prettier tidies the result.
 */
const ensureImport = (source: string, names: string[], from: string) => {
  const existing = new RegExp(
    `import \\{([^}]*)\\} from "${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";`,
  ).exec(source);
  if (existing) {
    const current = existing[1]
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const merged = [...new Set([...current, ...names])];
    return source.replace(
      existing[0],
      `import { ${merged.join(", ")} } from "${from}";`,
    );
  }
  const line = `import { ${names.join(", ")} } from "${from}";\n`;
  const imports = [...source.matchAll(/^import [\s\S]*?;\n/gm)];
  const last = imports.pop();
  return last
    ? source.slice(0, last.index + last[0].length) +
        line +
        source.slice(last.index + last[0].length)
    : line + source;
};

/** An array literal's contents, ready for one more element. */
const appendable = (list: string) =>
  list.trim() ? list.trimEnd().replace(/,?$/, ",") : "";

const needsId = (verb: Verb) => ["Describe", "Update", "Delete"].includes(verb);

const defaultRoute = (a: Answers) => {
  const one = `/${camel(a.entity)}`;
  const many = `/${camel(a.entityPlural)}`;
  switch (a.verb) {
    case "Describe":
    case "Update":
    case "Delete":
      return `${one}/:${camel(a.entity)}Id`;
    case "Get":
      return `${many}/statistics`;
    default:
      return many;
  }
};

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  const repo = plop.getDestBasePath();
  const api = path.join(repo, "apps/api/src");
  const model = path.join(repo, "packages/model/src");

  plop.setHelper("camel", camel);
  plop.setHelper("pascal", pascal);
  plop.setHelper("words", words);
  plop.setHelper("eq", (a: unknown, b: unknown) => a === b);

  plop.setGenerator("api-operation", {
    description:
      "Scaffold an API operation: controller, model shapes, converter stub, module registration and a test",
    prompts: [
      {
        type: "list",
        name: "domain",
        message: "Domain",
        choices: ["olympus", "dionysus", "minerva"],
      },
      {
        type: "input",
        name: "area",
        message:
          "Feature folder under src/<domain> (e.g. notes, content/channels); a new folder gets its own module",
        validate: (v: string) =>
          /^[a-z][a-zA-Z]*(\/[a-z][a-zA-Z]*)*$/.test(v) ||
          "lowerCamel folder(s)",
      },
      {
        type: "input",
        name: "module",
        message:
          "Feature module (created, and added to the domain module, if new)",
        default: (a: Answers) =>
          existingModule(path.join(api, a.domain, a.area)) ??
          `${pascal(a.area)}Module`,
        validate: (v: string) =>
          /^[A-Z][A-Za-z0-9]*Module$/.test(v) || "PascalCase ending in Module",
      },
      { type: "list", name: "verb", message: "Verb", choices: [...VERBS] },
      {
        type: "input",
        name: "entity",
        message:
          "Model entity class (must exist in @ncfritz/olympus-model), e.g. Note",
        validate: (v: string) => /^[A-Z][A-Za-z0-9]*$/.test(v) || "PascalCase",
      },
      {
        type: "input",
        name: "entityPlural",
        message: "Plural of the entity",
        default: (a: Answers) => plural(a.entity),
      },
      {
        type: "input",
        name: "operationId",
        message: "operationId",
        default: (a: Answers) =>
          a.verb === "List" ? `List${a.entityPlural}` : `${a.verb}${a.entity}`,
        validate: (v: string) => /^[A-Z][A-Za-z0-9]*$/.test(v) || "PascalCase",
      },
      {
        type: "input",
        name: "route",
        message: "Route (without the domain prefix)",
        default: defaultRoute,
      },
      {
        type: "input",
        name: "tag",
        message: "OpenAPI tag",
        default: (a: Answers) =>
          pascal(a.area.split("/").pop() ?? a.area).replace(
            /([a-z])([A-Z])/g,
            "$1 $2",
          ),
      },
      {
        type: "input",
        name: "hasuraTable",
        message: "Hasura table (root field), e.g. minerva_notes",
        validate: (v: string) => /^[a-z][a-z0-9_]*$/.test(v) || "snake_case",
      },
      {
        type: "list",
        name: "idType",
        message:
          "GraphQL type of the primary key `id` (Describe/Update/Delete)",
        choices: ["uuid", "String", "Int"],
      },
      {
        type: "input",
        name: "modelFile",
        message:
          "Model file for the request/response shapes (under packages/model/src)",
        default: (a: Answers) => `${a.domain}/${a.area.split("/")[0]}.ts`,
      },
      {
        type: "input",
        name: "bodyType",
        message: "Model class carried in the request body (Create/Update)",
        default: (a: Answers) => `Partial${a.entity}`,
      },
      {
        type: "confirm",
        name: "paginated",
        message: "Paginated and filterable? (List)",
        default: true,
      },
    ],
    actions: (raw) => {
      const a = raw as Answers;
      const areaDir = path.join(api, a.domain, a.area);
      const controllerDir = path.join(areaDir, "controllers");
      const toSrc = path.relative(controllerDir, api).split(path.sep).join("/");
      const idParam = `${camel(a.entity)}Id`;
      const numericId = a.idType === "Int";
      const testDir = path.join(repo, "apps/api/test/api", a.domain);
      const specFile = path.join(testDir, `${a.operationId}.spec.ts`);
      const service = `${a.entity}Service`;
      const serviceFile = path.join(areaDir, "services", `${service}.ts`);
      const existingService = fs.existsSync(serviceFile)
        ? fs.readFileSync(serviceFile, "utf8")
        : "";
      const isDefaultOperationId =
        a.operationId ===
        (a.verb === "List" ? `List${a.entityPlural}` : `${a.verb}${a.entity}`);
      const shortMethod = a.verb.toLowerCase();
      const method =
        isDefaultOperationId &&
        a.verb !== "Get" &&
        !new RegExp(`\\basync ${shortMethod}\\(`).test(existingService)
          ? shortMethod
          : camel(a.operationId);
      const data = {
        ...a,
        isPaginated: a.verb === "List" && a.paginated,
        toSrc,
        idParam,
        numericId,
        idTsType: numericId ? "number" : "string",
        hasId: needsId(a.verb),
        hasBody: a.verb === "Create" || a.verb === "Update",
        entityCamel: camel(a.entity),
        entitiesCamel: camel(a.entityPlural),
        requestClass: `${a.operationId}Request`,
        responseClass: `${a.operationId}Response`,
        converter: `${a.entity}Converter`,
        service,
        serviceProp: camel(a.entityPlural),
        method,
        nestMethod: {
          Describe: "Get",
          List: "Get",
          Get: "Get",
          Create: "Post",
          Update: "Put",
          Delete: "Delete",
        }[a.verb],
        usesConverter: a.verb !== "Delete" && a.verb !== "Get",
        // HTTP test: path params become sample values.
        testUrl: `/v1/${a.domain}${a.route}`.replace(
          /:(\w+)/g,
          numericId ? "1" : "missing-$1",
        ),
        toTestSupport: path
          .relative(testDir, path.join(repo, "apps/api/test/support"))
          .split(path.sep)
          .join("/"),
        [`is${a.verb}`]: true,
      };
      Object.assign(data, {
        httpMethod: data.nestMethod.toLowerCase(),
        nestMethodUpper: data.nestMethod.toUpperCase(),
      });

      const controllerFile = path.join(
        controllerDir,
        `${a.operationId}Controller.ts`,
      );
      const converterFile = path.join(
        areaDir,
        "converters",
        `${a.entity}Converter.ts`,
      );
      const modelFile = path.join(model, a.modelFile);
      const moduleFile = path.join(areaDir, `${a.module}.ts`);
      const domainModule = `${pascal(a.domain)}Module`;
      const domainModuleFile = path.join(api, a.domain, `${domainModule}.ts`);
      const touched = [
        serviceFile,
        controllerFile,
        specFile,
        modelFile,
        moduleFile,
        domainModuleFile,
      ];

      return [
        {
          type: "add",
          path: controllerFile,
          templateFile: "templates/api-operation/controller.ts.hbs",
          data,
          abortOnFail: true,
        },
        {
          type: "add",
          path: specFile,
          templateFile: "templates/api-operation/controller.spec.ts.hbs",
          data,
        },
        {
          type: "add",
          path: converterFile,
          templateFile: "templates/api-operation/converter.ts.hbs",
          data,
          skipIfExists: true,
        },
        // Model shapes: append to the area file, creating it (and exporting
        // it from the domain index) if needed.
        () => {
          if (!fs.existsSync(modelFile)) {
            fs.writeFileSync(
              modelFile,
              'import { ApiProperty } from "@nestjs/swagger";\n',
            );
            const index = path.join(path.dirname(modelFile), "index.ts");
            const exportLine = `export * from "./${path.basename(modelFile, ".ts")}";\n`;
            fs.appendFileSync(index, exportLine);
          }
          const shapes = plop.renderString(
            fs.readFileSync(
              path.join(__dirname, "templates/api-operation/model.ts.hbs"),
              "utf8",
            ),
            data,
          );
          let source = fs.readFileSync(modelFile, "utf8");
          // Import the entity / body classes if they live in another file.
          const classFile = (name: string): string | undefined => {
            const walk = (dir: string): string[] =>
              fs
                .readdirSync(dir, { withFileTypes: true })
                .flatMap((e) =>
                  e.isDirectory()
                    ? walk(path.join(dir, e.name))
                    : e.name.endsWith(".ts")
                      ? [path.join(dir, e.name)]
                      : [],
                );
            return walk(model).find((f) =>
              new RegExp(`export class ${name}\\b`).test(
                fs.readFileSync(f, "utf8"),
              ),
            );
          };
          for (const name of new Set([
            a.entity,
            ...(data.hasBody ? [a.bodyType] : []),
          ])) {
            if (
              new RegExp(
                `export class ${name}\\b|import[^;]*\\b${name}\\b`,
              ).test(source)
            )
              continue;
            const file = classFile(name);
            if (!file)
              throw new Error(
                `No model class ${name} found in packages/model/src`,
              );
            let spec = path
              .relative(path.dirname(modelFile), file)
              .replace(/\.ts$/, "")
              .split(path.sep)
              .join("/");
            if (!spec.startsWith(".")) spec = `./${spec}`;
            source = `import { ${name} } from "${spec}";\n${source}`;
          }
          if (!/\bApiProperty\b/.test(source)) {
            source = `import { ApiProperty } from "@nestjs/swagger";\n${source}`;
          }
          if (
            a.verb === "List" &&
            a.paginated &&
            !/\bPaginatedResults\b/.test(source)
          ) {
            const common = path
              .relative(path.dirname(modelFile), path.join(model, "common"))
              .split(path.sep)
              .join("/");
            source = `import { PaginatedResults } from "${common.startsWith(".") ? common : `./${common}`}";\n${source}`;
          }
          fs.writeFileSync(modelFile, `${source.trimEnd()}\n\n${shapes}`);
          return `appended shapes to ${path.relative(repo, modelFile)}`;
        },
        // A new feature folder gets its module, listed in the domain module
        // (which serves it under /<domain> and puts it in the OpenAPI
        // document).
        () => {
          if (fs.existsSync(moduleFile)) return `using ${a.module}`;
          fs.writeFileSync(
            moduleFile,
            [
              'import { Module } from "@nestjs/common";',
              `import { GraphQLClientModule } from "${path
                .relative(areaDir, path.join(api, "infra/GraphQLClientModule"))
                .split(path.sep)
                .join("/")}";`,
              "",
              "@Module({",
              "  imports: [GraphQLClientModule],",
              "  controllers: [],",
              "})",
              `export class ${a.module} {}`,
              "",
            ].join("\n"),
          );
          let source = fs.readFileSync(domainModuleFile, "utf8");
          const importPath = `./${path
            .relative(path.dirname(domainModuleFile), moduleFile)
            .replace(/\.ts$/, "")
            .split(path.sep)
            .join("/")}`;
          source = `import { ${a.module} } from "${importPath}";\n${source}`;
          source = source.replace(
            /_MODULES = \[([\s\S]*?)\]/,
            (_, list: string) =>
              `_MODULES = [${appendable(list)}\n  ${a.module},\n]`,
          );
          fs.writeFileSync(domainModuleFile, source);
          return `created ${a.module} and added it to ${domainModule}`;
        },
        // The data access goes in the entity's service: create it if needed,
        // append the method and add the imports it uses.
        () => {
          let source =
            existingService ||
            plop.renderString(
              fs.readFileSync(
                path.join(__dirname, "templates/api-operation/service.ts.hbs"),
                "utf8",
              ),
              data,
            );
          const methodText = plop.renderString(
            fs.readFileSync(
              path.join(
                __dirname,
                "templates/api-operation/service-method.ts.hbs",
              ),
              "utf8",
            ),
            data,
          );
          const close = source.lastIndexOf("}");
          source = `${source.slice(0, close).trimEnd()}\n\n${methodText.trimEnd()}\n}\n`;
          const nest = ["Injectable"];
          if (["Describe", "Update", "Delete"].includes(a.verb))
            nest.push("NotFoundException");
          source = ensureImport(source, nest, "@nestjs/common");
          source = ensureImport(
            source,
            ["gql", "GraphQLClient"],
            "graphql-request",
          );
          const modelNames = [
            ...(a.verb === "Delete" ? [] : [a.entity]),
            ...(data.hasBody ? [a.bodyType] : []),
          ];
          if (modelNames.length)
            source = ensureImport(source, modelNames, "@ncfritz/olympus-model");
          if (a.verb !== "Delete" && a.verb !== "Get")
            source = ensureImport(
              source,
              [`GraphQl${a.entity}`, "toDomainObject"],
              `../converters/${a.entity}Converter`,
            );
          if (data.isPaginated)
            source = ensureImport(
              source,
              [
                "buildFilterExpression",
                "buildPaginationExpression",
                "PaginationParams",
              ],
              `${path
                .relative(path.dirname(serviceFile), path.join(api, "utils"))
                .split(path.sep)
                .join("/")}/filterUtil`,
            );
          fs.mkdirSync(path.dirname(serviceFile), { recursive: true });
          fs.writeFileSync(serviceFile, source);
          return `${existingService ? "added" : "created"} ${service}.${method}()`;
        },
        // Register the controller (and the service) in the feature module.
        () => {
          let source = fs.readFileSync(moduleFile, "utf8");
          const importPath = `./${path
            .relative(path.dirname(moduleFile), controllerFile)
            .replace(/\.ts$/, "")
            .split(path.sep)
            .join("/")}`;
          const className = `${a.operationId}Controller`;
          const importLine = `import { ${className} } from "${importPath}";\n`;
          const lastImport = [
            ...source.matchAll(/^import [\s\S]*?;\n/gm),
          ].pop();
          source = lastImport
            ? source.slice(0, lastImport.index + lastImport[0].length) +
              importLine +
              source.slice(lastImport.index + lastImport[0].length)
            : importLine + source;
          source = source.replace(
            /controllers:\s*\[([\s\S]*?)\]/,
            (_, list: string) =>
              `controllers: [${appendable(list)}\n    ${className},\n  ]`,
          );
          if (!new RegExp(`\\b${service}\\b`).test(source)) {
            source = ensureImport(source, [service], `./services/${service}`);
            source = /providers:\s*\[/.test(source)
              ? source.replace(
                  /providers:\s*\[([\s\S]*?)\]/,
                  (_, list: string) =>
                    `providers: [${appendable(list)} ${service}]`,
                )
              : source.replace(
                  /controllers:\s*\[/,
                  `providers: [${service}],\n  controllers: [`,
                );
          }
          fs.writeFileSync(moduleFile, source);
          return `registered ${className} in ${a.module}`;
        },
        () => {
          execFileSync(
            path.join(repo, "node_modules/.bin/prettier"),
            ["--write", ...touched, converterFile],
            { cwd: repo, stdio: "ignore" },
          );
          return "formatted with prettier";
        },
        () =>
          [
            "Next:",
            "  1. Fill in the TODOs (GraphQL selection, converter fields, descriptions).",
            `  2. pnpm --filter @ncfritz/olympus-api check:conventions`,
            "  3. pnpm turbo run openapi --filter=@ncfritz/olympus-api  (commit the spec diff)",
          ].join("\n"),
      ];
    },
  });
}
