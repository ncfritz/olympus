// node --test infra/docker/test/*.test.mjs
//
// check.mjs, against certificates made here with openssl, and the
// conventions it checks held by the compose and env files themselves:
// server.crt / client.crt, a TLS directory named for its service, and
// Olympus's data under olympus/<apps|agents>/<folder>.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkStack, namingProblems, tlsSettings } from "../check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const docker = join(here, "..");
const repo = join(docker, "..", "..");

const openssl = (...args) => execFileSync("openssl", args, { stdio: "pipe" });

/** A CA, and a function issuing from it into a directory. */
const authority = (dir, cn = "Test Service Issuing CA") => {
  const key = join(dir, "ca.key");
  const crt = join(dir, "ca.crt");
  openssl(
    "req",
    "-x509",
    "-newkey",
    "ec",
    "-pkeyopt",
    "ec_paramgen_curve:P-256",
    "-nodes",
    "-keyout",
    key,
    "-out",
    crt,
    "-days",
    "365",
    "-subj",
    `/CN=${cn}`,
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
  );
  const issue = (out, name, { subject, usage, san, days = 90 }) => {
    mkdirSync(out, { recursive: true });
    const k = join(out, `${name}.key`);
    const csr = join(out, `${name}.csr`);
    const ext = join(out, `${name}.ext`);
    openssl(
      "req",
      "-new",
      "-newkey",
      "ec",
      "-pkeyopt",
      "ec_paramgen_curve:P-256",
      "-nodes",
      "-keyout",
      k,
      "-out",
      csr,
      "-subj",
      subject,
    );
    writeFileSync(
      ext,
      `extendedKeyUsage=${usage}\n${san ? `subjectAltName=${san}\n` : ""}`,
    );
    openssl(
      "x509",
      "-req",
      "-in",
      csr,
      "-CA",
      crt,
      "-CAkey",
      key,
      "-CAcreateserial",
      "-out",
      join(out, `${name}.crt`),
      "-days",
      String(days),
      "-extfile",
      ext,
    );
  };
  return { crt, issue };
};

/** A service's TLS directory with the convention's files. */
const tlsDir = (root, ca, service, { server = {}, client = {} } = {}) => {
  const dir = join(root, "tls", service);
  ca.issue(dir, "server", {
    subject: `/CN=${server.cn ?? service}`,
    usage: server.usage ?? "serverAuth",
    san: server.san ?? `DNS:${service}`,
  });
  ca.issue(dir, "client", {
    subject: client.subject ?? `/CN=${service}/OU=prod`,
    usage: client.usage ?? "clientAuth",
  });
  writeFileSync(join(dir, "services-ca.crt"), readFileSync(ca.crt));
  writeFileSync(join(dir, "root.crl"), "not checked\n");
  return dir;
};

const listener = {
  TLS_CERT: "/run/secrets/tls/server.crt",
  TLS_KEY: "/run/secrets/tls/server.key",
  TLS_CA_SERVICES: "/run/secrets/tls/services-ca.crt",
  TLS_CRL_SERVICES: "/run/secrets/tls/root.crl",
};
const caller = {
  API_CLIENT_CERT: "/run/secrets/tls/client.crt",
  API_CLIENT_KEY: "/run/secrets/tls/client.key",
  API_CA_CERT: "/run/secrets/tls/services-ca.crt",
};

const service = (tls, environment, data) => ({
  environment,
  volumes: [
    { type: "bind", source: tls, target: "/run/secrets/tls" },
    ...(data ? [{ type: "bind", source: data, target: "/data" }] : []),
  ],
});

const problems = (lines) => lines.filter((l) => l.startsWith("problem: "));
const warnings = (lines) => lines.filter((l) => l.startsWith("warning: "));

test("passes certificates made by the convention, and lists each one", () => {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const ca = authority(root);
  const data = join(root, "data");
  mkdirSync(data);
  writeFileSync(join(data, "kept"), "");
  const lines = checkStack(
    {
      services: {
        "mail-agent": service(
          tlsDir(root, ca, "mail-agent"),
          { ...listener, ...caller, AUTH_SERVICE_CLIENTS: "api" },
          data,
        ),
      },
    },
    { issuerCn: "Test Service Issuing CA", ou: "prod" },
  );
  assert.deepEqual(problems(lines), []);
  assert.deepEqual(warnings(lines), []);
  assert.ok(
    lines.some((l) =>
      /ok: mail-agent: server\.crt CN=mail-agent; SAN mail-agent/.test(l),
    ),
    lines.join("\n"),
  );
  assert.ok(
    lines.some((l) =>
      /ok: mail-agent: client\.crt CN=mail-agent, OU=prod/.test(l),
    ),
    lines.join("\n"),
  );
});

test("a server certificate without the service's name in its SAN is a problem", () => {
  // ERR_TLS_CERT_ALTNAME_INVALID at the caller, and a hang-up at the listener.
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const ca = authority(root);
  const dir = tlsDir(root, ca, "mail-agent", {
    server: { san: "DNS:mail-agent.example.net" },
  });
  const found = problems(
    checkStack({ services: { "mail-agent": service(dir, listener) } }),
  );
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(
    found[0],
    /SAN is DNS:mail-agent\.example\.net; it needs DNS:mail-agent/,
  );
});

test("a client certificate's CN is the service's identity; OU and issuer only warn", () => {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const ca = authority(root, "Some Other CA");
  const dir = tlsDir(root, ca, "classifier", {
    client: { subject: "/CN=old-name/OU=dev" },
  });
  const lines = checkStack(
    { services: { classifier: service(dir, caller) } },
    { issuerCn: "Test Service Issuing CA", ou: "prod" },
  );
  assert.equal(problems(lines).length, 1, lines.join("\n"));
  assert.match(
    problems(lines)[0],
    /client\.crt's CN is old-name; the convention is classifier/,
  );
  assert.ok(warnings(lines).some((l) => /OU=prod/.test(l)));
  assert.ok(
    warnings(lines).some((l) => /expected CN=Test Service Issuing CA/.test(l)),
  );
});

test("wrong usage, a stranger's key and another CA's certificate are problems", () => {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const ca = authority(root);
  const other = authority(mkdtempSync(join(tmpdir(), "check-")));
  const dir = tlsDir(root, ca, "api", { server: { usage: "clientAuth" } });
  other.issue(join(root, "stranger"), "client", {
    subject: "/CN=api",
    usage: "clientAuth",
  });
  writeFileSync(
    join(dir, "client.key"),
    readFileSync(join(root, "stranger", "client.key")),
  );
  const found = problems(
    checkStack({ services: { api: service(dir, { ...listener, ...caller }) } }),
  );
  assert.ok(
    found.some((l) => /server\.crt is not for serverAuth/.test(l)),
    found.join("\n"),
  );
  assert.ok(
    found.some((l) => /client\.key is not this certificate's key/.test(l)),
    found.join("\n"),
  );
});

test("a certificate from outside services-ca.crt is a problem", () => {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const ca = authority(root);
  const dir = tlsDir(root, ca, "api");
  const other = authority(mkdtempSync(join(tmpdir(), "check-")), "Elsewhere");
  writeFileSync(join(dir, "services-ca.crt"), readFileSync(other.crt));
  const found = problems(
    checkStack({ services: { api: service(dir, listener) } }),
  );
  assert.ok(
    found.some((l) => /was not issued by a CA in services-ca\.crt/.test(l)),
    found.join("\n"),
  );
});

test("a certificate within 30 days of expiry warns", () => {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const ca = authority(root);
  const dir = tlsDir(root, ca, "api");
  ca.issue(dir, "server", {
    subject: "/CN=api",
    usage: "serverAuth",
    san: "DNS:api",
    days: 10,
  });
  const lines = checkStack({ services: { api: service(dir, listener) } });
  assert.deepEqual(problems(lines), []);
  assert.ok(
    warnings(lines).some((l) => /server\.crt expires/.test(l)),
    lines.join("\n"),
  );
});

test("missing files and folders are problems; an empty data folder warns", () => {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const dir = join(root, "tls", "api");
  mkdirSync(dir, { recursive: true });
  const empty = join(root, "empty");
  mkdirSync(empty);
  const lines = checkStack({
    services: {
      api: service(dir, listener, empty),
      gone: {
        volumes: [
          { type: "bind", source: join(root, "nowhere"), target: "/data" },
        ],
      },
    },
  });
  const found = problems(lines);
  assert.ok(
    found.some((l) => /api: missing .*server\.crt/.test(l)),
    found.join("\n"),
  );
  assert.ok(
    found.some((l) => /gone: missing .*nowhere/.test(l)),
    found.join("\n"),
  );
  assert.ok(warnings(lines).some((l) => /empty/.test(l)));
});

test("names other than server.* and client.* break the convention", () => {
  const found = namingProblems(
    "api",
    tlsSettings({
      TLS_CERT: "/run/secrets/tls/api.crt",
      TLS_KEY: "/run/secrets/tls/api.key",
      MINERVA_MAIL_AGENT_CLIENT_CERT: "/run/secrets/tls/client.crt",
      MINERVA_MAIL_AGENT_CLIENT_KEY: "/run/secrets/tls/agent.key",
    }),
  );
  assert.equal(found.length, 3, found.join("\n"));
});

test("a caller its callee's listener does not list warns", () => {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const ca = authority(root);
  const lines = checkStack({
    services: {
      "mail-agent": service(tlsDir(root, ca, "mail-agent"), {
        ...caller,
        MAIL_ML_URL: "https://mail-agent-ml:3107/v1",
      }),
      "mail-agent-ml": service(tlsDir(root, ca, "mail-agent-ml"), {
        ...listener,
        SERVICES_ALLOWED_CLIENTS: "mail-ml-old",
      }),
    },
  });
  assert.ok(
    warnings(lines).some((l) =>
      /mail-agent calls mail-agent-ml, whose listener does not list it/.test(l),
    ),
    lines.join("\n"),
  );
});

// ---- The repository's own files.

const envFiles = () =>
  ["prod", "local"].flatMap((env) =>
    readdirSync(join(docker, "env", env))
      .filter((f) => f.endsWith(".env"))
      .map((f) => join(docker, "env", env, f)),
  );

test("every env file names its TLS files server.* and client.*", () => {
  const bad = [];
  for (const file of envFiles()) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      // Commented-out settings too: they are what gets uncommented.
      const m = /^#?\s*([A-Z_]+)=(\/run\/secrets\/tls\/\S+)/.exec(line);
      if (!m) continue;
      bad.push(
        ...namingProblems(
          file.slice(docker.length + 1),
          tlsSettings({ [m[1]]: m[2] }),
        ),
      );
    }
  }
  assert.deepEqual(bad, []);
});

const compose = (name) =>
  readFileSync(join(docker, "compose", `${name}.yml`), "utf8");

/** Each service's block of a compose file, by name. */
const blocks = (text) => {
  const out = {};
  const body = text.split(/^services:\n/m)[1].split(/^\S/m)[0];
  for (const part of body.split(/^(?=  [a-z][\w-]*:\s*$)/m)) {
    const m = /^ {2}([a-z][\w-]*):\s*$/m.exec(part);
    if (m) out[m[1]] = part;
  }
  return out;
};

test("a service's TLS directory is named for the service, and bootstrap makes it", () => {
  const stack = readFileSync(join(docker, "stack.sh"), "utf8");
  const made =
    /for dir in (olympus-api[\s\S]*?); do\s+mkdir -p "\$SECRETS_DIR\/tls/
      .exec(stack)[1]
      .replace(/\\\n/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  for (const file of ["olympus", "nas"]) {
    for (const [name, block] of Object.entries(blocks(compose(file)))) {
      const m = /SECRETS_DIR:\?\}\/tls\/([\w-]+):\/run\/secrets\/tls/.exec(
        block,
      );
      if (!m) continue;
      assert.equal(m[1], name, `${file}.yml: ${name} mounts tls/${m[1]}`);
      if (file === "olympus")
        assert.ok(made.includes(name), `bootstrap does not make tls/${name}`);
    }
  }
});

test("Olympus's data is under olympus/<apps|agents>/<folder>, and bootstrap makes it", () => {
  const stack = readFileSync(join(docker, "stack.sh"), "utf8");
  const made = /for dir in (postgres[\s\S]*?); do\s+mkdir -p "\$DATA_DIR/
    .exec(stack)[1]
    .replace(/\\\n/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const mounts = [
    ...compose("olympus").matchAll(/\$\{DATA_DIR:\?\}\/([^:\s]+):/g),
  ].map((m) => m[1]);
  assert.ok(mounts.length > 0);
  for (const path of mounts) {
    const m = /^olympus\/(apps|agents)\/([\w-]+)/.exec(path);
    assert.ok(m, `${path} is not under olympus/<apps|agents>/<folder>`);
    assert.ok(
      existsSync(join(repo, m[1], m[2])),
      `${path}: no ${m[1]}/${m[2]} in the repository`,
    );
    assert.ok(
      made.some((dir) => dir === path || dir.startsWith(`${path}/`)),
      `bootstrap does not make ${path}`,
    );
  }
});
