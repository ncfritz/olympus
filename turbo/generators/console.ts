/**
 * `pnpm gen console`: scaffolds a console for Olympus Control and registers
 * it everywhere it has to be registered (ADR 0021) — the shell's registry,
 * a bake target, a Compose service and an nginx stanza. Those five places
 * are the reason this generator exists: a console that is missing from one
 * of them is either invisible, unbuilt or unreachable.
 */
import type { PlopTypes } from "@turbo/gen";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const SEGMENT = /^[a-z][a-z0-9-]*$/;

const titleCase = (segment: string) =>
  segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

type Answers = {
  property: string;
  propertyLabel: string;
  name: string;
  label: string;
  description: string;
  placement: "agent" | "app";
  dir: string;
  packageName: string;
  port: string;
  hasAgent: boolean;
  agentPort: string;
};

/** The index of the `]` matching the `[` at `open`. */
const matching = (source: string, open: number): number => {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "[") depth += 1;
    else if (source[i] === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error("unbalanced brackets");
};

const insertAt = (source: string, at: number, text: string) =>
  source.slice(0, at) + text + source.slice(at);

const read = (file: string) => fs.readFileSync(file, "utf8");

/** Fails loudly: a half-registered console is worse than a failed generator. */
const anchor = (source: string, needle: string, file: string): number => {
  const at = source.indexOf(needle);
  if (at === -1) {
    throw new Error(`Could not find "${needle}" in ${file} — register by hand`);
  }
  return at;
};

export const registerConsoleGenerator = (plop: PlopTypes.NodePlopAPI): void => {
  const repo = plop.getDestBasePath();
  const registryFile = path.join(repo, "packages/console/src/registry.ts");
  const bakeFile = path.join(repo, "docker-bake.hcl");
  const composeFile = path.join(repo, "infra/docker/compose/olympus.yml");
  const nginxFile = path.join(repo, "infra/docker/nginx/control.conf");

  const properties = (): string[] =>
    [...read(registryFile).matchAll(/^    key: "([a-z0-9-]+)",$/gm)].map(
      (match) => match[1],
    );

  plop.setGenerator("console", {
    description:
      "Scaffold a console for Olympus Control: the package, and its place in the registry, the bake file, Compose and nginx",
    prompts: [
      {
        type: "input",
        name: "property",
        message: "Property it belongs to (olympus, dionysus, minerva, …)",
        validate: (v: string) =>
          SEGMENT.test(v) || "lower case, digits, dashes",
      },
      {
        type: "input",
        name: "propertyLabel",
        message: "The property's label (it is not in the registry yet)",
        when: (a: Answers) => !properties().includes(a.property),
        default: (a: Answers) => titleCase(a.property),
      },
      {
        type: "input",
        name: "name",
        message: "The console, within its property (calendar, metadata, ca, …)",
        validate: (v: string) =>
          SEGMENT.test(v) || "lower case, digits, dashes",
      },
      {
        type: "input",
        name: "label",
        message: "Its label",
        default: (a: Answers) => titleCase(a.name),
      },
      {
        type: "input",
        name: "description",
        message: "One line: the sider's tooltip and the index's card",
        validate: (v: string) => v.trim().length > 0 || "required",
      },
      {
        type: "list",
        name: "placement",
        message: "Where it lives",
        choices: [
          { name: "beside its agent: agents/<agent>/console", value: "agent" },
          { name: "on its own: apps/<name>-console", value: "app" },
        ],
      },
      {
        type: "input",
        name: "dir",
        message: "Directory, from the repository root",
        default: (a: Answers) =>
          a.placement === "agent"
            ? `agents/${a.property}-${a.name}/console`
            : `apps/${a.name}-console`,
      },
      {
        type: "input",
        name: "packageName",
        message: "Package name",
        default: (a: Answers) =>
          a.placement === "agent"
            ? `@ncfritz/${path.basename(path.dirname(a.dir))}-console`
            : `@ncfritz/${a.property}-${a.name}-console`,
      },
      {
        type: "input",
        name: "port",
        message: "Port it listens on",
        default: "4393",
        validate: (v: string) => /^\d{2,5}$/.test(v) || "a port",
      },
      {
        type: "confirm",
        name: "hasAgent",
        message: "Does it have an agent of its own, published under it?",
        default: (a: Answers) => a.placement === "agent",
      },
      {
        type: "input",
        name: "agentPort",
        message: "The agent's port",
        when: (a: Answers) => a.hasAgent,
        default: "4433",
        validate: (v: string) => /^\d{2,5}$/.test(v) || "a port",
      },
    ],
    actions: (raw) => {
      const a = raw as Answers;
      const key = `${a.property}/${a.name}`;
      const consolePath = `/${a.property}/${a.name}`;
      const service = `${a.property}-${a.name}-console`;
      const agentService = `${a.property}-${a.name}-agent`;
      const variable = `${a.property}_${a.name}`.replace(/-/g, "_");
      const dir = path.join(repo, a.dir);
      const depth = a.dir.split("/").length;
      const data = {
        ...a,
        consoleKey: key,
        consolePath,
        service,
        agentService,
        toRepoRoot: Array(depth).fill("..").join("/"),
        toDocs: `${Array(depth).fill("..").join("/")}/docs`,
      };

      const file = (to: string, template: string) => ({
        type: "add" as const,
        path: path.join(dir, to),
        templateFile: `templates/console/${template}`,
        data,
        abortOnFail: true,
      });

      return [
        file("package.json", "package.json.hbs"),
        file("tsconfig.json", "tsconfig.json.hbs"),
        file("eslint.config.mjs", "eslint.config.mjs.hbs"),
        file("next.config.ts", "next.config.ts.hbs"),
        file("README.md", "README.md.hbs"),
        file(".env.local.example", "env.local.example.hbs"),
        file("src/app/globals.css", "app/globals.css.hbs"),
        file("src/app/layout.tsx", "app/layout.tsx.hbs"),
        file("src/app/page.tsx", "app/page.tsx.hbs"),
        file("src/components/AppLayout.tsx", "components/AppLayout.tsx.hbs"),
        file("src/components/Home.tsx", "components/Home.tsx.hbs"),
        file("src/lib/api/client.ts", "lib/client.ts.hbs"),
        () => {
          fs.copyFileSync(
            path.join(repo, "apps/control/.gitignore"),
            path.join(dir, ".gitignore"),
          );
          return `created ${a.dir}`;
        },

        // 1. The shell's registry: what every console's sider shows.
        () => {
          let source = read(registryFile);
          const entry = `      {
        key: "${a.name}",
        label: "${a.label}",
        description: "${a.description}",
      },\n`;
          if (properties().includes(a.property)) {
            const at = anchor(source, `    key: "${a.property}",`, "registry");
            const consoles = anchor(
              source.slice(at),
              "consoles: [",
              "registry",
            );
            const open = at + consoles + "consoles: ".length;
            source = insertAt(source, matching(source, open), entry);
          } else {
            const open = anchor(
              source,
              "export const PROPERTIES: Registry = [",
              "registry",
            );
            const at = matching(source, source.indexOf("[", open));
            source = insertAt(
              source,
              at,
              `  {
    key: "${a.property}",
    label: "${a.propertyLabel}",
    consoles: [
${entry}    ],
  },\n`,
            );
          }
          fs.writeFileSync(registryFile, source);
          return `registered ${key} in packages/console/src/registry.ts`;
        },

        // 2. The image.
        () => {
          let source = read(bakeFile);
          const target = `target "${service}" {
  context    = "."
  dockerfile = "infra/docker/next/Dockerfile"
  platforms  = ["linux/arm64"]
  args = {
    APP          = "${a.packageName}"
    APP_DIR      = "${a.dir}"
    PORT         = "${a.port}"
    GIT_REVISION = GIT_REVISION
    # Where the control host publishes this console (ADR 0021).
    NEXT_PUBLIC_BASE_PATH = "${consolePath}"
  }
  tags = image("${service}")
}\n\n`;
          source = insertAt(source, anchor(source, 'target "', "bake"), target);
          // The services group, not the default one: that lists groups.
          const group = anchor(source, 'group "services"', "bake");
          const open = source.indexOf("[", group);
          source = insertAt(
            source,
            matching(source, open),
            `  "${service}",\n  `,
          );
          fs.writeFileSync(bakeFile, source);
          return `added the ${service} bake target`;
        },

        // 3. What runs it.
        () => {
          let source = read(composeFile);
          const entry = `
  ${service}:
    <<: *service
    image: \${IMAGE_PREFIX:?}/${service}:\${OLYMPUS_TAG:?}
    environment:
      CONTROL_CONSOLES: \${CONTROL_CONSOLES:?}
    networks:
      - edge
`;
          source = insertAt(
            source,
            anchor(source, "\nnetworks:", "compose"),
            entry,
          );
          fs.writeFileSync(composeFile, source);
          return `added the ${service} Compose service`;
        },

        // 4. How it is reached.
        () => {
          let source = read(nginxFile);
          const agent = a.hasAgent
            ? `    set $${variable}_agent   ${agentService}:${a.agentPort};
`
            : "";
          const api = a.hasAgent
            ? `
    # The rest of the path reaches the agent as the browser sent it, still
    # percent-encoded ($request_uri, not the decoded $uri).
    location ${consolePath}/api/ {
        rewrite ^ $request_uri;
        rewrite ^${consolePath}/api/(.*) $1 break;
        return 400;
        proxy_pass http://$${variable}_agent/$uri;
    }
`
            : "";
          const stanza = `    # ---- ${a.propertyLabel || titleCase(a.property)}: ${a.label}
${agent}    set $${variable}_console ${service}:${a.port};
${api}
    location ${consolePath} {
        proxy_pass http://$${variable}_console;
    }

`;
          source = insertAt(
            source,
            anchor(source, "    # The index, and anything", "control.conf"),
            stanza,
          );
          fs.writeFileSync(nginxFile, source);
          return `added the ${consolePath} nginx stanza`;
        },

        () => {
          execFileSync(
            path.join(repo, "node_modules/.bin/prettier"),
            ["--write", dir, registryFile, composeFile],
            { cwd: repo, stdio: "ignore" },
          );
          return "formatted with prettier";
        },
        () =>
          [
            "Next:",
            "  1. pnpm install",
            `  2. pnpm --filter ${a.packageName} dev`,
            "  3. Add CONTROL_CONSOLES entries for the hosts that run it",
            "     (infra/docker/env/<host>.env).",
            ...(a.hasAgent
              ? [
                  `  4. The agent is not scaffolded: give it AUTH_BASE_URL`,
                  `     https://\${CONTROL_HOST}${consolePath}/api and WEB_APP_URL`,
                  `     https://\${CONTROL_HOST}${consolePath}, and a Compose service`,
                  `     named ${agentService}.`,
                ]
              : []),
          ].join("\n"),
      ];
    },
  });
};
