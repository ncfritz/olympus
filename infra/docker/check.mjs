// stack.sh check's look at what a stack mounts, on this host:
//
//   docker compose ... config --format json | node infra/docker/check.mjs
//
// Every bind mount's source is there (a missing one Docker would create
// empty, which is how a moved data directory starts over unnoticed), and
// every certificate a service is pointed at is the one it should be:
//
//   server.crt  CN and SAN the service's name (the name the others call it
//               by), serverAuth, its key beside it as server.key
//   client.crt  CN the service's name (who it is to the API and to other
//               listeners), clientAuth, client.key beside it
//
// both issued by a CA in the services-ca.crt the service trusts (and,
// when TLS_SERVICES_ISSUER is set, by that CA, or a warning), unexpired, and named by the
// convention (docs/conventions/general.md, Deployment). One line a
// finding, "problem: ", "warning: " or "ok: ", for stack.sh to count; a
// problem is something that will fail, a warning something that differs
// from the convention but works.
//
// Reads the settings from the environment: TLS_SERVICES_ISSUER (the
// issuing CA's CN) and TLS_CLIENT_OU (the OU every client certificate on
// this host carries), both optional.
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

/**
 * One certificate and its key: read, matched, issued by one of the CAs,
 * for the usage, named for the service, in date. Pushes findings.
 */
export const checkPair = ({
  label,
  service,
  certPath,
  keyPath,
  cas,
  usage,
  requireSan,
  requireCn,
  issuerCn,
  ou,
  now = new Date(),
  report,
}) => {
  const where = `${service}: ${label}`;
  let cert;
  try {
    [cert] = certificates(readFileSync(certPath, "utf8"));
  } catch (e) {
    report.problem(`${where} unreadable (${certPath}): ${e.message}`);
    return;
  }
  if (!cert) {
    report.problem(`${where} holds no certificate (${certPath})`);
    return;
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

  const issuedBy = cas.find((ca) => {
    try {
      return cert.checkIssued(ca) && cert.verify(ca.publicKey);
    } catch {
      return false;
    }
  });
  if (cas.length && !issuedBy) {
    report.problem(
      `${where} (issuer ${oneLine(cert.issuer)}) was not issued by a CA in services-ca.crt`,
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
};

/** Every finding for a stack's resolved compose configuration. */
export const checkStack = (config, { issuerCn, ou, now } = {}) => {
  const lines = [];
  const report = {
    problem: (text) => lines.push(`problem: ${text}`),
    warning: (text) => lines.push(`warning: ${text}`),
    ok: (text) => lines.push(`ok: ${text}`),
  };
  const services = Object.entries(config.services ?? {});

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

    const settings = tlsSettings(service.environment);
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

    const cas = [...settings.cas].flatMap((path) => {
      try {
        return certificates(readFileSync(host(path), "utf8"));
      } catch {
        return [];
      }
    });
    if (settings.cas.size && !cas.length) {
      report.problem(
        `${name}: no certificate in ${[...settings.cas].map(host).join(", ")}`,
      );
    }

    if (settings.server.cert && settings.server.key) {
      checkPair({
        label: basename(settings.server.cert),
        service: name,
        certPath: host(settings.server.cert),
        keyPath: host(settings.server.key),
        cas,
        usage: SERVER_AUTH,
        requireSan: true,
        requireCn: false,
        issuerCn,
        now,
        report,
      });
    }
    const clientCerts = [...(settings.client.cert ?? [])];
    const clientKeys = [...(settings.client.key ?? [])];
    for (const [i, path] of clientCerts.entries()) {
      checkPair({
        label: basename(path),
        service: name,
        certPath: host(path),
        keyPath: host(
          clientKeys[i] ?? clientKeys[0] ?? path.replace(/\.crt$/, ".key"),
        ),
        cas,
        usage: CLIENT_AUTH,
        requireSan: false,
        requireCn: true,
        issuerCn,
        ou,
        now,
        report,
      });
    }
  }

  // Who calls whom: a service with a client certificate that calls another
  // service's listener has to be on that listener's list.
  const allowed = (env, keys) =>
    keys.flatMap((k) =>
      String(env?.[k] ?? "")
        .split(",")
        .map((x) => x.trim().split(":")[0])
        .filter(Boolean),
    );
  for (const [caller, service] of services) {
    const env = service.environment ?? {};
    if (!tlsSettings(env).client.cert) continue;
    for (const value of Object.values(env)) {
      const match = /^https:\/\/([^/:]+)/.exec(String(value));
      const callee = match && services.find(([n]) => n === match[1]);
      if (!callee || callee[0] === caller) continue;
      const list = allowed(callee[1].environment, [
        "AUTH_SERVICE_ROLES",
        "AUTH_SERVICE_CLIENTS",
        "SERVICES_ALLOWED_CLIENTS",
      ]);
      if (list.length && !list.includes(caller)) {
        report.warning(
          `${caller} calls ${callee[0]}, whose listener does not list it`,
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
        issuerCn: process.env.TLS_SERVICES_ISSUER || undefined,
        ou: process.env.TLS_CLIENT_OU || undefined,
      });
      if (lines.length) console.log(lines.join("\n"));
    });
}
