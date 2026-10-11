import { Inject, Injectable } from "@nestjs/common";
import { createPrivateKey, randomBytes, X509Certificate } from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import type { DeployableCertificate } from "../../certificates/services/CertificateService";
import {
  deployConfig,
  type DeployConfigType,
} from "../../config/configuration";

/** The files a host-path target holds, as nginx's directives name them. */
export const HOST_PATH_FILES = {
  /** The certificate and the CAs above it, not the root: `ssl_certificate`. */
  fullChain: "fullchain.pem",
  /** The certificate alone. */
  certificate: "cert.pem",
  /** Its key, unencrypted, readable by its owner only: `ssl_certificate_key`. */
  privateKey: "privkey.pem",
  /**
   * Written last, once the rest is in place: what the web server's watcher
   * waits for before it reloads.
   */
  marker: "deployed",
} as const;

/**
 * A host-path target (ADR 0020, Renewal and delivery): a directory under
 * DEPLOY_DIR, named for the target, that the web server mounts read-only
 * and reloads from when its `deployed` file changes. Each file is
 * replaced whole (written aside, then renamed), the key before the
 * certificate, so a reader never sees half of either.
 */
@Injectable()
export class HostPathDeployer {
  constructor(
    @Inject(deployConfig.KEY) private readonly config: DeployConfigType,
  ) {}

  /** The target's directory. */
  directoryOf(name: string): string {
    if (path.basename(name) !== name || name.startsWith(".")) {
      throw new Error(`${name} is not a directory name`);
    }
    return path.join(this.config.dir, name);
  }

  async write(
    name: string,
    deployable: DeployableCertificate,
    deployment: { certificateId: string; serial: string },
  ): Promise<void> {
    try {
      await fs.stat(this.config.dir);
    } catch {
      throw new Error(
        `The deploy directory ${this.config.dir} does not exist: is it mounted?`,
      );
    }
    const dir = this.directoryOf(name);
    await fs.mkdir(dir, { recursive: true, mode: 0o750 });
    const fullChain = [deployable.certificate, ...deployable.chain].join("");
    await replace(
      dir,
      HOST_PATH_FILES.privateKey,
      deployable.privateKey,
      0o600,
    );
    await replace(dir, HOST_PATH_FILES.certificate, deployable.certificate);
    await replace(dir, HOST_PATH_FILES.fullChain, fullChain);
    await this.check(dir, deployment.serial);
    await replace(
      dir,
      HOST_PATH_FILES.marker,
      [
        `certificate=${deployment.certificateId}`,
        `serial=${deployment.serial}`,
        `deployed=${new Date().toISOString()}`,
        "",
      ].join("\n"),
    );
  }

  /** What was written reads back as the certificate and its key. */
  private async check(dir: string, serial: string): Promise<void> {
    const certificate = new X509Certificate(
      await fs.readFile(path.join(dir, HOST_PATH_FILES.fullChain)),
    );
    if (BigInt(`0x${certificate.serialNumber}`) !== BigInt(`0x${serial}`)) {
      throw new Error(
        `${HOST_PATH_FILES.fullChain} reads back as serial ${certificate.serialNumber}, not ${serial}`,
      );
    }
    const key = createPrivateKey(
      await fs.readFile(path.join(dir, HOST_PATH_FILES.privateKey)),
    );
    if (!certificate.checkPrivateKey(key)) {
      throw new Error(
        `${HOST_PATH_FILES.privateKey} is not the key of ${HOST_PATH_FILES.fullChain}`,
      );
    }
  }
}

/** Writes a file aside and renames it into place. */
const replace = async (
  dir: string,
  file: string,
  content: string,
  mode = 0o644,
): Promise<void> => {
  const target = path.join(dir, file);
  const aside = path.join(
    dir,
    `.${file}.${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await fs.writeFile(aside, content, { mode });
    // writeFile's mode is masked by the umask; the key's must not be.
    await fs.chmod(aside, mode);
    await fs.rename(aside, target);
  } catch (error) {
    await fs.rm(aside, { force: true });
    throw error;
  }
};
