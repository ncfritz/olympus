import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * The throwaway certificates of `scripts/dev-ca.sh`, created on first use.
 * Tests that need a client certificate read them from here.
 */
const root = path.resolve(__dirname, "../../../..");
const certs = path.join(root, "infra/dev-ca/certs");

export const devCa = (): string => {
  if (!fs.existsSync(path.join(certs, "api.crt"))) {
    execFileSync("bash", [path.join(root, "scripts/dev-ca.sh")], {
      stdio: "ignore",
    });
  }
  return certs;
};

/** A certificate and its key, as TLS options. */
export const identity = (name: string) => ({
  cert: fs.readFileSync(path.join(devCa(), `${name}.crt`)),
  key: fs.readFileSync(path.join(devCa(), `${name}.key`)),
});

/**
 * Every revocation list in the fixture, as separate files.
 *
 * Discovered rather than listed, because a hard-coded set goes stale and
 * fails in the least obvious way: Node checks the whole chain and a chain
 * with no list refuses *every* certificate (ADR 0023). This fixture's chain
 * got a level deeper -- agents are issued by a Service Issuing CA under
 * Intermediate CA 2 under the root -- and a hard-coded services.crl plus
 * root.crl then refused every agent with "unable to get certificate CRL",
 * while the tests that expect a refusal carried on passing for the wrong
 * reason.
 *
 * Lists for other chains (devices, tls, signing) are harmless here: a
 * certificate from another chain still fails at issuer lookup, which is what
 * the wrong-CA and device-certificate cases assert.
 *
 * `*-chain.crl` is excluded on purpose. Those hold several lists in one file
 * for nginx, and Node reads only the first list in a file.
 */
const revocationLists = (): string[] =>
  fs
    .readdirSync(devCa())
    .filter((name) => name.endsWith(".crl") && !name.endsWith("-chain.crl"))
    .sort()
    .map((name) => path.join(devCa(), name));

/** The services listener's configuration, on an ephemeral port. */
export const servicesConfig = (port = 0) => ({
  enabled: true,
  port,
  certificate: path.join(devCa(), "api.crt"),
  key: path.join(devCa(), "api.key"),
  ca: path.join(devCa(), "services-ca.crt"),
  revocationLists: revocationLists(),
});
