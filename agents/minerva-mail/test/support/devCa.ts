import * as fs from "fs";
import * as path from "path";

/**
 * The repository's dev CA (`scripts/dev-ca.sh`), for tests that need real
 * certificates on both ends of a handshake. Run the script once first.
 */
export const DEV_CA = path.resolve(__dirname, "../../../../infra/dev-ca/certs");

export const certs = (name: string) => ({
  cert: fs.readFileSync(path.join(DEV_CA, `${name}.crt`)),
  key: fs.readFileSync(path.join(DEV_CA, `${name}.key`)),
});

/** Every revocation list but the nginx chains, one file each. */
export const revocationLists = (): string[] =>
  fs
    .readdirSync(DEV_CA)
    .filter((n) => n.endsWith(".crl") && !n.endsWith("-chain.crl"))
    .map((n) => path.join(DEV_CA, n));
