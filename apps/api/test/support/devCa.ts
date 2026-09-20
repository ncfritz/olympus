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

/** The services listener's configuration, on an ephemeral port. */
export const servicesConfig = (port = 0) => ({
  enabled: true,
  port,
  certificate: path.join(devCa(), "api.crt"),
  key: path.join(devCa(), "api.key"),
  ca: path.join(devCa(), "services-ca.crt"),
  revocationLists: [
    path.join(devCa(), "services.crl"),
    path.join(devCa(), "root.crl"),
  ],
});
