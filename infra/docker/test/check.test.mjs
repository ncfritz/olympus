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
import tls from "node:tls";
import {
  certificates,
  chainTo,
  chainsTo,
  strictProblems,
  checkStack,
  namingProblems,
  tlsSettings,
} from "../check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const docker = join(here, "..");
const repo = join(docker, "..", "..");

const openssl = (...args) => execFileSync("openssl", args, { stdio: "pipe" });

const ec = ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256", "-nodes"];

/**
 * A CA, self-signed or issued by a parent, and a function issuing from it
 * into a directory.
 */
const authority = (
  dir,
  cn = "Test Service Issuing CA",
  parent,
  caExtensions = "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n",
) => {
  mkdirSync(dir, { recursive: true });
  const slug = cn.replace(/\W+/g, "-");
  const key = join(dir, `${slug}.key`);
  const crt = join(dir, `${slug}.crt`);
  const caExt = [
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-addext",
    "keyUsage=critical,keyCertSign,cRLSign",
  ];
  if (parent) {
    const csr = join(dir, `${slug}.csr`);
    const ext = join(dir, `${slug}.ext`);
    openssl(
      "req",
      "-new",
      ...ec,
      "-keyout",
      key,
      "-out",
      csr,
      "-subj",
      `/CN=${cn}`,
    );
    writeFileSync(ext, caExtensions);
    openssl(
      "x509",
      "-req",
      "-in",
      csr,
      "-CA",
      parent.crt,
      "-CAkey",
      parent.key,
      "-CAcreateserial",
      "-out",
      crt,
      "-days",
      "365",
      "-extfile",
      ext,
    );
  } else {
    openssl(
      "req",
      "-x509",
      ...ec,
      "-keyout",
      key,
      "-out",
      crt,
      "-days",
      "365",
      "-subj",
      `/CN=${cn}`,
      ...caExt,
    );
  }
  const issue = (out, name, { subject, usage, san, days = 90, extra = "" }) => {
    mkdirSync(out, { recursive: true });
    const k = join(out, `${name}.key`);
    const csr = join(out, `${name}.csr`);
    const ext = join(out, `${name}.ext`);
    openssl("req", "-new", ...ec, "-keyout", k, "-out", csr, "-subj", subject);
    writeFileSync(
      ext,
      `extendedKeyUsage=${usage}\n${san ? `subjectAltName=${san}\n` : ""}${extra}`,
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
  return { cn, key, crt, issue };
};

/**
 * The prod hierarchy in small: one root, and beside each other under it
 * the CA server certificates come from and the one service (client)
 * certificates come from.
 */
const hierarchy = (dir) => {
  const root = authority(join(dir, "ca"), "Test Root CA");
  const servers = authority(join(dir, "ca"), "Test Issuing CA 2", root);
  const services = authority(join(dir, "ca"), "Test Service Issuing CA", root);
  return { root, servers, services };
};

/** A CA file: the certificates named, concatenated. */
const bundle = (...cas) =>
  cas.map((ca) => readFileSync(ca.crt, "utf8")).join("");

/**
 * A service's TLS directory with the convention's files: server.crt from
 * the server CA, client.crt from the service CA, and services-ca.crt
 * holding the whole hierarchy unless told otherwise.
 */
const tlsDir = (
  dir,
  cas,
  service,
  { server = {}, client = {}, trust } = {},
) => {
  const out = join(dir, "tls", service);
  (server.ca ?? cas.servers).issue(out, "server", {
    subject: `/CN=${server.cn ?? service}`,
    usage: server.usage ?? "serverAuth",
    san: server.san ?? `DNS:${service}`,
  });
  (client.ca ?? cas.services).issue(out, "client", {
    subject: client.subject ?? `/CN=${service}/OU=prod`,
    usage: client.usage ?? "clientAuth",
  });
  writeFileSync(
    join(out, "services-ca.crt"),
    trust ?? bundle(cas.root, cas.servers, cas.services),
  );
  writeFileSync(join(out, "root.crl"), "not checked\n");
  return out;
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

/** The API calling an agent's listener, and the agent calling the API's. */
const pair = (dir, cas, { api = {}, agent = {} } = {}) => ({
  services: {
    api: service(tlsDir(dir, cas, "api", api), {
      ...listener,
      AUTH_SERVICES_ISSUER: cas.services.cn,
      AUTH_SERVICE_ROLES: "agent:agent",
      AGENT_URL: "https://agent:4435/v1",
      AGENT_CLIENT_CERT: "/run/secrets/tls/client.crt",
      AGENT_CLIENT_KEY: "/run/secrets/tls/client.key",
      AGENT_CA_CERT: "/run/secrets/tls/services-ca.crt",
    }),
    agent: service(tlsDir(dir, cas, "agent", agent), {
      ...listener,
      ...caller,
      API_BASE_URL: "https://api:3443/v1",
      AUTH_SERVICES_ISSUER: cas.services.cn,
      AUTH_SERVICE_CLIENTS: "api",
    }),
  },
});

test("passes the convention, with server and client certificates from different CAs", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const config = pair(dir, cas);
  const data = join(dir, "data");
  mkdirSync(data);
  writeFileSync(join(data, "kept"), "");
  config.services.agent.volumes.push({
    type: "bind",
    source: data,
    target: "/data",
  });
  const lines = checkStack(config, {
    serverIssuer: cas.servers.cn,
    clientIssuer: cas.services.cn,
    ou: "prod",
  });
  assert.deepEqual(problems(lines), []);
  assert.deepEqual(warnings(lines), []);
  for (const expected of [
    /ok: agent: server\.crt CN=agent; SAN agent; issuer Test Issuing CA 2/,
    /ok: agent: client\.crt CN=agent, OU=prod; SAN none; issuer Test Service Issuing CA/,
    /ok: api calls agent \(AGENT_URL\): agent's server certificate verifies/,
    /ok: api calls agent \(AGENT_URL\): api's client certificate verifies/,
    /ok: agent calls api \(API_BASE_URL\): api's server certificate verifies/,
  ]) {
    assert.ok(
      lines.some((l) => expected.test(l)),
      `${expected}\n${lines.join("\n")}`,
    );
  }
});

test("a server certificate without the service's name in its SAN is a problem", () => {
  // ERR_TLS_CERT_ALTNAME_INVALID at the caller, and a hang-up at the listener.
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const found = problems(
    checkStack(
      pair(dir, cas, { agent: { server: { san: "DNS:agent.example.net" } } }),
    ),
  );
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(
    found[0],
    /agent: server\.crt's SAN is DNS:agent\.example\.net; it needs DNS:agent/,
  );
});

test("a server certificate is verified with the caller's CA file, not its own", () => {
  // The listener's own services-ca.crt is for its callers' certificates;
  // what matters for its server certificate is what the caller trusts.
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const found = problems(
    checkStack(
      pair(dir, cas, {
        agent: { trust: bundle(cas.root, cas.services) },
        api: { trust: bundle(cas.root, cas.services) },
      }),
    ),
  );
  assert.ok(
    found.some((l) =>
      /api calls agent \(AGENT_URL\): agent's server certificate \(issuer CN=Test Issuing CA 2\) does not chain to a root in .*tls\/api\/services-ca\.crt, which api verifies it with/.test(
        l,
      ),
    ),
    found.join("\n"),
  );
  assert.ok(
    found.some((l) => /agent calls api .* api's server certificate/.test(l)),
    found.join("\n"),
  );
  assert.ok(!found.some((l) => /client certificate/.test(l)), found.join("\n"));
});

test("a server certificate that presents its issuing CA chains with the root alone", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const config = pair(dir, cas, {
    api: { trust: bundle(cas.root, cas.services) },
  });
  const agentDir = join(dir, "tls", "agent");
  writeFileSync(
    join(agentDir, "server.crt"),
    readFileSync(join(agentDir, "server.crt"), "utf8") + bundle(cas.servers),
  );
  const found = problems(checkStack(config));
  assert.ok(
    !found.some((l) => /api calls agent .* server certificate/.test(l)),
    found.join("\n"),
  );
});

test("a CA file without the root does not verify, as Node will not", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const found = problems(
    checkStack(
      pair(dir, cas, { api: { trust: bundle(cas.servers, cas.services) } }),
    ),
  );
  assert.ok(
    found.some((l) => /api calls agent .* does not chain to a root/.test(l)),
    found.join("\n"),
  );
});

test("a client certificate from another issuer than the listener requires is a problem", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const found = problems(
    checkStack(pair(dir, cas, { api: { client: { ca: cas.servers } } })),
  );
  assert.ok(
    found.some((l) =>
      /api calls agent \(AGENT_URL\): api's client certificate is from Test Issuing CA 2; agent accepts only Test Service Issuing CA/.test(
        l,
      ),
    ),
    found.join("\n"),
  );
});

test("a client certificate's CN is the service's identity; OU and issuer only warn", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const other = authority(join(dir, "other"), "Some Other CA");
  const out = tlsDir(dir, cas, "classifier", {
    client: { subject: "/CN=old-name/OU=dev", ca: other },
  });
  const lines = checkStack(
    { services: { classifier: service(out, caller) } },
    { clientIssuer: cas.services.cn, ou: "prod" },
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

test("wrong usage and a stranger's key are problems", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const other = authority(join(dir, "other"), "Elsewhere");
  const out = tlsDir(dir, cas, "api", { server: { usage: "clientAuth" } });
  other.issue(join(dir, "stranger"), "client", {
    subject: "/CN=api",
    usage: "clientAuth",
  });
  writeFileSync(
    join(out, "client.key"),
    readFileSync(join(dir, "stranger", "client.key")),
  );
  const found = problems(
    checkStack({ services: { api: service(out, { ...listener, ...caller }) } }),
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

test("a certificate within 30 days of expiry warns", () => {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(root);
  const dir = tlsDir(root, cas, "api");
  cas.servers.issue(dir, "server", {
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
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const config = pair(dir, cas);
  config.services.agent.environment.AUTH_SERVICE_CLIENTS = "someone-else";
  const lines = checkStack(config);
  assert.ok(
    warnings(lines).some((l) =>
      /api calls agent \(AGENT_URL\): agent's listener does not list api/.test(
        l,
      ),
    ),
    lines.join("\n"),
  );
});

test("chainsTo agrees with Node's own TLS handshake", async () => {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const out = join(dir, "leaf");
  cas.servers.issue(out, "server", {
    subject: "/CN=agent",
    usage: "serverAuth",
    san: "DNS:agent",
  });
  const leaf = readFileSync(join(out, "server.crt"), "utf8");
  const key = readFileSync(join(out, "server.key"), "utf8");
  const handshake = (cert, ca) =>
    new Promise((resolve) => {
      const server = tls.createServer({ key, cert }, (s) => s.end());
      server.listen(0, "127.0.0.1", () => {
        const client = tls.connect(
          {
            port: server.address().port,
            host: "127.0.0.1",
            servername: "agent",
            ca,
          },
          () => {
            client.end();
            server.close();
            resolve(true);
          },
        );
        client.on("error", () => {
          server.close();
          resolve(false);
        });
      });
    });
  for (const [cert, ca] of [
    [leaf, bundle(cas.root, cas.servers, cas.services)],
    [leaf, bundle(cas.root, cas.services)],
    [leaf + bundle(cas.servers), bundle(cas.root, cas.services)],
    [leaf, bundle(cas.servers, cas.services)],
  ]) {
    const [first, ...presented] = certificates(cert);
    assert.equal(
      chainsTo(first, presented, certificates(ca)),
      await handshake(cert, ca),
      `${certificates(ca)
        .map((c) => c.subject)
        .join(" + ")}`,
    );
  }
});

test("a server chain X.509 strict mode refuses warns: Python callers will", () => {
  // Python 3.13's ssl.create_default_context() verifies in strict mode, so
  // the classifier refused the API's certificate for want of an Authority
  // Key Identifier while every Node caller took it.
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const cas = hierarchy(dir);
  const config = pair(dir, cas);
  cas.servers.issue(join(dir, "tls", "api"), "server", {
    subject: "/CN=api",
    usage: "serverAuth",
    san: "DNS:api",
    extra: "authorityKeyIdentifier=none\nsubjectKeyIdentifier=none\n",
  });
  const lines = checkStack(config);
  assert.deepEqual(problems(lines), []);
  assert.ok(
    warnings(lines).some((l) =>
      /agent calls api \(API_BASE_URL\): api's server certificate chain fails X\.509 strict mode.*api has no Authority Key Identifier/.test(
        l,
      ),
    ),
    lines.join("\n"),
  );
  assert.ok(
    !warnings(lines).some((l) => /agent's server certificate chain/.test(l)),
    lines.join("\n"),
  );
});

test("a CA whose Basic Constraints are not critical fails strict mode", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-"));
  const root = authority(join(dir, "ca"), "Test Root CA");
  const loose = authority(
    join(dir, "ca"),
    "Loose Issuing CA",
    root,
    "basicConstraints=CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n",
  );
  loose.issue(join(dir, "leaf"), "server", {
    subject: "/CN=api",
    usage: "serverAuth",
    san: "DNS:api",
  });
  const path = chainTo(
    certificates(readFileSync(join(dir, "leaf", "server.crt"), "utf8"))[0],
    [],
    certificates(bundle(root, loose)),
  );
  assert.ok(path);
  assert.deepEqual(strictProblems(path), [
    "Loose Issuing CA's Basic Constraints are not critical",
  ]);
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
