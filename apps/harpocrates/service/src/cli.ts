/**
 * The break-glass CLI (ADR 0020, Surfaces): issue, revoke and check the
 * seal and the audit log without the console or the API's tokens, against
 * the database and the signer directly. In the image:
 *
 *   docker compose exec harpocrates node dist/cli.js <command> [options]
 *
 *   status
 *   issue --profile <id> --cn <name> [--ou <unit>] [--dns <name>]...
 *         [--ip <address>]... [--csr <file>] [--issuer <id>]
 *   revoke --certificate <id> --reason <reason> [--comment <text>]
 *   audit-verify
 *
 * It acts as `cli:<user>`, with pki-admin's rights, and everything it does
 * is in the audit log like anything else.
 */
import "source-map-support/register";

import { NestFactory } from "@nestjs/core";
import * as fs from "fs";
import * as os from "os";
import { AppModule } from "./AppModule";
import { AuditService } from "./audit/services/AuditService";
import { PkiRole, type Principal } from "./auth/principal";
import { CertificateService } from "./certificates/services/CertificateService";
import { readConfig } from "./config/configuration";
import type { RevocationReasonName } from "./model/certificates";
import { SealService } from "./signer/services/SealService";

type Options = Record<string, string[]>;

const parse = (args: string[]): { command?: string; options: Options } => {
  const [command, ...rest] = args;
  const options: Options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    if (!flag.startsWith("--")) throw new Error(`unexpected ${flag}`);
    const value = rest[i + 1];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    (options[flag.slice(2)] ??= []).push(value);
    i += 1;
  }
  return { command, options };
};

const one = (options: Options, name: string): string | undefined =>
  options[name]?.[0];

const required = (options: Options, name: string): string => {
  const value = one(options, name);
  if (!value) throw new Error(`--${name} is required`);
  return value;
};

const USAGE = `usage: cli.js status | issue --profile <id> --cn <name> [...] | revoke --certificate <id> --reason <reason> | audit-verify`;

async function main(args: string[]): Promise<number> {
  const { command, options } = parse(args);
  if (!command) {
    console.error(USAGE);
    return 2;
  }
  readConfig(process.env);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const principal: Principal = {
    id: `cli:${process.env.SUDO_USER ?? os.userInfo().username}`,
    roles: [PkiRole.Admin],
    authTime: Math.floor(Date.now() / 1000),
    surface: "cli",
  };
  try {
    switch (command) {
      case "status":
        console.log(
          JSON.stringify(await app.get(SealService).status(), null, 2),
        );
        return 0;
      case "issue": {
        const csrFile = one(options, "csr");
        const certificate = await app
          .get(CertificateService)
          .create(principal, {
            profileId: required(options, "profile"),
            issuerId: one(options, "issuer"),
            subject: {
              commonName: required(options, "cn"),
              organizationalUnit: one(options, "ou"),
            },
            names: { dns: options.dns, ip: options.ip, email: options.email },
            csr: csrFile ? fs.readFileSync(csrFile, "utf8") : undefined,
          });
        console.error(
          `issued ${certificate.id} (serial ${certificate.serial})`,
        );
        console.log(certificate.certificate);
        return 0;
      }
      case "revoke": {
        const revoked = await app
          .get(CertificateService)
          .revoke(principal, required(options, "certificate"), {
            reason: required(options, "reason") as RevocationReasonName,
            comment: one(options, "comment"),
          });
        for (const certificate of revoked) {
          console.log(
            `revoked ${certificate.id} (serial ${certificate.serial})`,
          );
        }
        return 0;
      }
      case "audit-verify": {
        const result = await app.get(AuditService).verify();
        console.log(
          result.valid
            ? `the audit log holds: ${result.events} events`
            : `the audit log breaks at event ${result.brokenAt} (after ${result.events} good ones)`,
        );
        return result.valid ? 0 : 1;
      }
      default:
        console.error(USAGE);
        return 2;
    }
  } finally {
    await app.close();
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
