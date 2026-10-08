// stack.sh check's look at what a stack mounts, on this host:
//
//   docker compose ... config --format json | node infra/docker/check.mjs
//
// Every bind mount's source is there (a missing one Docker would create
// empty, which is how a moved data directory starts over unnoticed), and
// every certificate a service is pointed at is the one it should be:
//
//   server.crt  SAN and CN the service's name (the name the others call
//               it by), serverAuth, its key beside it as server.key
//   client.crt  CN the service's name (who it is to the listeners it
//               calls), clientAuth, client.key beside it
//
// unexpired and named by the convention (docs/conventions/general.md,
// Deployment). Then each call between two services in the stack is
// checked from both ends, as Node will check it: the listener's server
// certificate chains to a root in the CA file the caller verifies it with,
// and the caller's client certificate to a root in the listener's
// TLS_CA_SERVICES, from the issuer the listener requires. Server and
// client certificates come from different CAs; each is checked against
// what its verifier trusts, not against its own directory's CA file.
//
// One line a finding, "problem: ", "warning: " or "ok: ", for stack.sh to
// count; a problem is something that will fail, a warning something that
// differs from the convention but works.
//
// Settings, from the environment, all optional: TLS_SERVER_ISSUER and
// TLS_SERVICES_ISSUER, the CNs of the CAs this host's server and client
// certificates come from (a warning when one differs), and TLS_CLIENT_OU,
// the OU its client certificates carry.
import { X509Certificate, createPrivateKey } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

export const TLS_TARGET = "/run/secrets/tls";
export const SERVER = { cert: "server.crt", key: "server.key" };
export const CLIENT = { cert: "client.crt", key: "client.key" };
const SERVER_AUTH = "1.3.6.1.5.5.7.3.1";
const CLIENT_AUTH = "1.3.6.1.5.5.7.3.2";
const SOON_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

const PEM = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

/** Every certificate in a PEM file, in order. */
export const certificates = (text) =>
  (String(text).match(PEM) ?? []).map((pem) => new X509Certificate(pem));

/** One attribute of a distinguished name as Node prints it ("CN=a\nOU=b"). */
export const attribute = (dn, name) =>
  String(dn ?? "")
    .split("\n")
    .map((line) => line.split("="))
    .find(([key]) => key === name)
    ?.slice(1)
    .join("=");

/** A distinguished name on one line, as openssl would show it. */
export const oneLine = (dn) =>
  String(dn ?? "")
    .split("\n")
    .join(", ");

/** The DNS names in a certificate's SAN. */
export const dnsNames = (cert) =>
  String(cert.subjectAltName ?? "")
    .split(/,\s*/)
    .filter((entry) => entry.startsWith("DNS:"))
    .map((entry) => entry.slice(4));

/** Extended key usages, or undefined when the certificate does not limit them. */
const usages = (cert) => cert.extKeyUsage ?? cert.keyUsage;

/**
 * What a service is told to read from its TLS directory, by variable: the
 * listener's pair (TLS_CERT, TLS_KEY), the client pair (API_CLIENT_* and
 * any other *_CLIENT_CERT / *_CLIENT_KEY), the CAs it trusts and the rest
 * (revocation lists).
 */
export const tlsSettings = (environment = {}) => {
  const found = {
    server: {},
    client: {},
    cas: new Set(),
    other: new Set(),
    names: [],
  };
  for (const [key, raw] of Object.entries(environment)) {
    if (typeof raw !== "string") continue;
    const paths = raw
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.startsWith(`${TLS_TARGET}/`));
    if (!paths.length) continue;
    found.names.push(key);
    for (const path of paths) {
      if (key === "TLS_CERT") found.server.cert = path;
      else if (key === "TLS_KEY") found.server.key = path;
      else if (key.endsWith("_CLIENT_CERT"))
        (found.client.cert ??= new Set()).add(path);
      else if (key.endsWith("_CLIENT_KEY"))
        (found.client.key ??= new Set()).add(path);
      else if (key === "TLS_CA_SERVICES" || key.endsWith("_CA_CERT"))
        found.cas.add(path);
      else found.other.add(path);
    }
  }
  return found;
};

/** The convention's names, or the findings that say how a service differs. */
export const namingProblems = (name, settings) => {
  const out = [];
  const want = (what, path, expected) => {
    if (path && path !== `${TLS_TARGET}/${expected}`) {
      out.push(
        `${name}: ${what} is ${path}; the convention is ${TLS_TARGET}/${expected}`,
      );
    }
  };
  want("TLS_CERT", settings.server.cert, SERVER.cert);
  want("TLS_KEY", settings.server.key, SERVER.key);
  for (const path of settings.client.cert ?? [])
    want("its client certificate", path, CLIENT.cert);
  for (const path of settings.client.key ?? [])
    want("its client key", path, CLIENT.key);
  return out;
};

const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const exists = (path) => {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
};

const safely = (fn) => {
  try {
    return fn();
  } catch {
    return false;
  }
};

/**
 * The chain from a certificate to a root in a CA file, the way Node
 * verifies a peer: up through the certificates the peer presents after its
 * own and those in the CA file, to a self-signed one that is in the CA
 * file -- or undefined. Node does not accept a chain that stops at an
 * intermediate.
 */
export const chainTo = (leaf, presented, anchors) => {
  const pool = [...presented, ...anchors];
  const trusted = (c) =>
    anchors.some((a) => a.fingerprint256 === c.fingerprint256);
  const path = [leaf];
  let current = leaf;
  for (let depth = 0; depth < 8; depth++) {
    if (
      trusted(current) &&
      safely(
        () => current.checkIssued(current) && current.verify(current.publicKey),
      )
    ) {
      return path;
    }
    const issuer = pool.find(
      (c) =>
        c.fingerprint256 !== current.fingerprint256 &&
        safely(() => current.checkIssued(c) && current.verify(c.publicKey)),
    );
    if (!issuer) return undefined;
    path.push(issuer);
    current = issuer;
  }
  return undefined;
};

/** Whether a certificate chains to a root in a CA file (chainTo). */
export const chainsTo = (leaf, presented, anchors) =>
  chainTo(leaf, presented, anchors) !== undefined;

/** An extension's OID as it appears in DER: 2.5.29.<n>. */
const extension = (n) => Buffer.from([0x06, 0x03, 0x55, 0x1d, n]);
const AUTHORITY_KEY_ID = 0x23;
const SUBJECT_KEY_ID = 0x0e;
const KEY_USAGE = 0x0f;
const BASIC_CONSTRAINTS = 0x13;
const has = (cert, n) => cert.raw.includes(extension(n));
/** An extension marked critical: its OID followed by BOOLEAN TRUE. */
const critical = (cert, n) => {
  const at = cert.raw.indexOf(extension(n));
  return (
    at >= 0 &&
    cert.raw[at + 5] === 0x01 &&
    cert.raw[at + 6] === 0x01 &&
    cert.raw[at + 7] === 0xff
  );
};

/**
 * What OpenSSL's X.509 strict mode (RFC 5280) refuses in a chain, which
 * Node accepts: Python 3.13's ssl.create_default_context() turns it on, so
 * a Python caller (the classifier) refuses a chain Node is happy with, and
 * the listener sees only "alert certificate unknown".
 */
export const strictProblems = (path) =>
  path.flatMap((cert) => {
    const name = attribute(cert.subject, "CN") ?? oneLine(cert.subject);
    const selfSigned = safely(() => cert.checkIssued(cert));
    const out = [];
    if (!selfSigned && !has(cert, AUTHORITY_KEY_ID))
      out.push(`${name} has no Authority Key Identifier`);
    if (cert.ca) {
      if (!critical(cert, BASIC_CONSTRAINTS))
        out.push(`${name}'s Basic Constraints are not critical`);
      if (!has(cert, KEY_USAGE)) out.push(`${name} has no Key Usage`);
      if (!has(cert, SUBJECT_KEY_ID))
        out.push(`${name} has no Subject Key Identifier`);
    }
    return out;
  });

/** A certificate file: its first certificate, and the chain after it. */
const readChain = (path) => {
  const [cert, ...presented] = certificates(readFileSync(path, "utf8"));
  return { cert, presented };
};

/**
 * One certificate and its key, on its own: read, matched, for the usage,
 * named for the service, from the expected issuer, in date. Whether it
 * verifies is a question for whoever it is presented to (checkStack).
 * Pushes findings; returns the certificate and the chain after it.
 */
export const checkPair = ({
  label,
  service,
  certPath,
  keyPath,
  usage,
  requireSan,
  requireCn,
  issuerCn,
  ou,
  now = new Date(),
  report,
}) => {
  const where = `${service}: ${label}`;
  let chain;
  try {
    chain = readChain(certPath);
  } catch (e) {
    report.problem(`${where} unreadable (${certPath}): ${e.message}`);
    return undefined;
  }
  const { cert } = chain;
  if (!cert) {
    report.problem(`${where} holds no certificate (${certPath})`);
    return undefined;
  }
  const subject = oneLine(cert.subject);
  const sans = dnsNames(cert);
  const cn = attribute(cert.subject, "CN");

  try {
    const key = createPrivateKey(readFileSync(keyPath));
    if (!cert.checkPrivateKey(key)) {
      report.problem(
        `${where}: ${basename(keyPath)} is not this certificate's key`,
      );
    }
  } catch (e) {
    report.problem(
      `${where}: its key is unreadable (${keyPath}): ${e.message}`,
    );
  }

  const limited = usages(cert);
  if (limited && !limited.includes(usage)) {
    const wanted = usage === SERVER_AUTH ? "serverAuth" : "clientAuth";
    report.problem(
      `${where} is not for ${wanted} (extended key usage ${limited.join(", ")})`,
    );
  }

  if (requireSan && !sans.includes(service)) {
    report.problem(
      `${where}'s SAN is ${sans.length ? sans.map((s) => `DNS:${s}`).join(", ") : "empty"}; ` +
        `it needs DNS:${service}, the name the others call it by`,
    );
  }
  if (cn !== service) {
    const text = `${where}'s CN is ${cn ?? "missing"}; the convention is ${service}`;
    if (requireCn) report.problem(`${text}, the name it is authorised by`);
    else report.warning(text);
  }
  if (ou && attribute(cert.subject, "OU") !== ou) {
    report.warning(
      `${where}'s subject is ${subject}; this host's client certificates carry OU=${ou}`,
    );
  }
  if (issuerCn && attribute(cert.issuer, "CN") !== issuerCn) {
    report.warning(
      `${where}'s issuer is ${oneLine(cert.issuer)}; expected CN=${issuerCn}`,
    );
  }

  const notAfter = new Date(cert.validTo);
  const notBefore = new Date(cert.validFrom);
  const until = notAfter.toISOString().slice(0, 10);
  if (notAfter < now) report.problem(`${where} expired ${until}`);
  else if (notBefore > now)
    report.problem(
      `${where} is not valid until ${notBefore.toISOString().slice(0, 10)}`,
    );
  else if (notAfter.getTime() - now.getTime() < SOON_DAYS * DAY)
    report.warning(`${where} expires ${until}`);

  report.ok(
    `${where} ${subject}; SAN ${sans.length ? sans.join(", ") : "none"}; ` +
      `issuer ${attribute(cert.issuer, "CN") ?? oneLine(cert.issuer)}; until ${until}`,
  );
  return chain;
};

/** The names a listener accepts callers by, from its settings. */
const allowedCallers = (env) =>
  [
    "AUTH_SERVICE_ROLES",
    "AUTH_SERVICE_CLIENTS",
    "SERVICES_ALLOWED_CLIENTS",
  ].flatMap((k) =>
    String(env?.[k] ?? "")
      .split(",")
      .map((x) => x.trim().split(":")[0])
      .filter(Boolean),
  );

/** The issuer a listener requires of its callers' certificates. */
const requiredIssuer = (env) =>
  env?.AUTH_SERVICES_ISSUER || env?.SERVICES_ISSUER || undefined;

/**
 * Every finding for a stack's resolved compose configuration.
 *
 * serverIssuer and clientIssuer are the CNs of the CAs this host's server
 * and client certificates come from (a warning when one differs); ou is
 * the OU its client certificates carry.
 */
export const checkStack = (
  config,
  { serverIssuer, clientIssuer, ou, now } = {},
) => {
  const lines = [];
  const report = {
    problem: (text) => lines.push(`problem: ${text}`),
    warning: (text) => lines.push(`warning: ${text}`),
    ok: (text) => lines.push(`ok: ${text}`),
  };
  const services = Object.entries(config.services ?? {});
  /** name -> { env, file(path) -> host path, server, clients: path -> chain } */
  const loaded = new Map();

  for (const [name, service] of services) {
    const binds = (service.volumes ?? []).filter((v) => v.type === "bind");
    for (const bind of binds) {
      if (!exists(bind.source)) {
        report.problem(
          `${name}: missing ${bind.source} (mounted at ${bind.target})`,
        );
      } else if (
        bind.target !== TLS_TARGET &&
        isDirectory(bind.source) &&
        readdirSync(bind.source).length === 0
      ) {
        report.warning(
          `${name}: ${bind.source} (mounted at ${bind.target}) is empty`,
        );
      }
    }

    const env = service.environment ?? {};
    const settings = tlsSettings(env);
    if (!settings.names.length) continue;
    for (const text of namingProblems(name, settings)) report.problem(text);
    const dir = binds.find((v) => v.target === TLS_TARGET)?.source;
    if (!dir) {
      report.problem(
        `${name}: ${settings.names.join(", ")} point into ${TLS_TARGET}, which nothing mounts`,
      );
      continue;
    }
    if (!isDirectory(dir)) continue; // reported above as missing
    const host = (path) => join(dir, posix.relative(TLS_TARGET, path));

    const wanted = new Set([
      settings.server.cert,
      settings.server.key,
      ...(settings.client.cert ?? []),
      ...(settings.client.key ?? []),
      ...settings.cas,
      ...settings.other,
    ]);
    let missing = false;
    for (const path of [...wanted].filter(Boolean).sort()) {
      if (!exists(host(path))) {
        report.problem(`${name}: missing ${host(path)}`);
        missing = true;
      } else if (statSync(host(path)).size === 0) {
        report.problem(`${name}: ${host(path)} is empty`);
        missing = true;
      }
    }
    if (missing) continue;

    for (const path of settings.cas) {
      if (
        !safely(() => certificates(readFileSync(host(path), "utf8")).length)
      ) {
        report.problem(`${name}: no certificate in ${host(path)}`);
      }
    }

    const entry = { env, host, server: undefined, clients: new Map() };
    loaded.set(name, entry);
    if (settings.server.cert && settings.server.key) {
      entry.server = checkPair({
        label: basename(settings.server.cert),
        service: name,
        certPath: host(settings.server.cert),
        keyPath: host(settings.server.key),
        usage: SERVER_AUTH,
        requireSan: true,
        requireCn: false,
        issuerCn: serverIssuer,
        now,
        report,
      });
    }
    const clientKeys = [...(settings.client.key ?? [])];
    for (const [i, path] of [...(settings.client.cert ?? [])].entries()) {
      entry.clients.set(
        path,
        checkPair({
          label: basename(path),
          service: name,
          certPath: host(path),
          keyPath: host(
            clientKeys[i] ?? clientKeys[0] ?? path.replace(/\.crt$/, ".key"),
          ),
          usage: CLIENT_AUTH,
          requireSan: false,
          requireCn: true,
          issuerCn: clientIssuer,
          ou,
          now,
          report,
        }),
      );
    }
  }

  // Each call between two services in the stack, both ways round: the
  // caller verifies the listener's server certificate against the CA file
  // it calls with (<PREFIX>_CA_CERT for <PREFIX>_URL, or API_CA_CERT), and
  // the listener verifies the caller's client certificate against its
  // TLS_CA_SERVICES, from the issuer it requires, and has it on its list.
  const anchorsOf = (entry, path) =>
    path
      ? safely(() => certificates(readFileSync(entry.host(path), "utf8"))) || []
      : [];
  for (const [caller, service] of services) {
    const env = service.environment ?? {};
    for (const [key, value] of Object.entries(env)) {
      const match = /^https:\/\/([^/:]+)/.exec(String(value));
      const callee = match?.[1];
      if (!callee || callee === caller || !services.some(([n]) => n === callee))
        continue;
      const prefix = key.replace(/_(BASE_)?URL$/, "");
      const from = loaded.get(caller);
      const to = loaded.get(callee);
      const calls = `${caller} calls ${callee} (${key})`;

      const caPath = env[`${prefix}_CA_CERT`] ?? env.API_CA_CERT;
      if (from && to?.server?.cert && caPath) {
        const { cert, presented } = to.server;
        const path = chainTo(cert, presented, anchorsOf(from, caPath));
        if (path) {
          report.ok(`${calls}: ${callee}'s server certificate verifies`);
          const strict = strictProblems(path);
          if (strict.length) {
            report.warning(
              `${calls}: ${callee}'s server certificate chain fails X.509 strict mode, ` +
                `which a Python caller refuses ("certificate unknown" at ${callee}): ${strict.join("; ")}`,
            );
          }
        } else {
          report.problem(
            `${calls}: ${callee}'s server certificate (issuer ${oneLine(cert.issuer)}) ` +
              `does not chain to a root in ${from.host(caPath)}, which ${caller} verifies it with`,
          );
        }
      }

      const clientPath = env[`${prefix}_CLIENT_CERT`] ?? env.API_CLIENT_CERT;
      const client = clientPath && from?.clients.get(clientPath);
      if (!client || !to) continue;
      const toEnv = to.env;
      const listenerCa = toEnv.TLS_CA_SERVICES;
      if (listenerCa) {
        if (
          chainsTo(client.cert, client.presented, anchorsOf(to, listenerCa))
        ) {
          report.ok(`${calls}: ${caller}'s client certificate verifies`);
        } else {
          report.problem(
            `${calls}: ${caller}'s client certificate (issuer ${oneLine(client.cert.issuer)}) ` +
              `does not chain to a root in ${to.host(listenerCa)}, which ${callee} verifies it with`,
          );
        }
      }
      const issuer = requiredIssuer(toEnv);
      if (issuer && attribute(client.cert.issuer, "CN") !== issuer) {
        report.problem(
          `${calls}: ${caller}'s client certificate is from ${attribute(client.cert.issuer, "CN")}; ` +
            `${callee} accepts only ${issuer}`,
        );
      }
      const list = allowedCallers(toEnv);
      if (list.length && !list.includes(caller)) {
        report.warning(
          `${calls}: ${callee}'s listener does not list ${caller}`,
        );
      }
    }
  }
  return lines;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let input = "";
  process.stdin
    .on("data", (d) => (input += d))
    .on("end", () => {
      const lines = checkStack(JSON.parse(input), {
        serverIssuer: process.env.TLS_SERVER_ISSUER || undefined,
        clientIssuer: process.env.TLS_SERVICES_ISSUER || undefined,
        ou: process.env.TLS_CLIENT_OU || undefined,
      });
      if (lines.length) console.log(lines.join("\n"));
    });
}
