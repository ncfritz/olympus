import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * The throwaway certificates of `scripts/dev-ca.sh`, created on first use.
 * Tests that need a certificate read them from here by path, the way a
 * service does.
 */
const root = path.resolve(__dirname, "../../../..");
const certs = path.join(root, "infra/dev-ca/certs");

/** The path of a file in the dev CA's output, creating it if need be. */
export const devCaFile = (name: string): string => {
  if (!fs.existsSync(path.join(certs, "api.crt"))) {
    execFileSync("bash", [path.join(root, "scripts/dev-ca.sh")], {
      stdio: "ignore",
    });
  }
  return path.join(certs, name);
};
