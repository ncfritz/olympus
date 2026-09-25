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
 *   crls                  sign the lists that are due and publish what is not out
 *   import-issuer --id <slug> --tier <root|intermediate|issuing>
 *         --number <n> --generation <g> [--purpose <purpose>]
 *         --certificate <file> [--chain <file>]...
 *         [--max-validity-days <days>] [--eku <oid>]...
 *         [--key <encrypted PKCS#8 file> --passphrase-file <file>]
 *   import-crl --issuer <slug> --crl <file, PEM or DER>
 *
 * A revocation here asks for a new list; the running service's scheduler
 * signs it (this process never schedules anything).
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
import { CrlScheduler } from "./crls/services/CrlScheduler";
import { CrlService } from "./crls/services/CrlService";
import type { IssuerTierName } from "./issuers/issuerNames";
import { IssuerService } from "./issuers/services/IssuerService";
import type { RevocationReasonName } from "./model/certificates";
import { toPem } from "./pki/x509";
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

const USAGE = `usage: cli.js status | issue --profile <id> --cn <name> [...] | revoke --certificate <id> --reason <reason> | audit-verify | crls | import-issuer --id <slug> --tier <tier> [...] | import-crl --issuer <slug> --crl <file>`;

const integerOption = (options: Options, name: string, fallback?: number) => {
  const raw = one(options, name);
  if (raw === undefined) {
    if (fallback === undefined) throw new Error(`--${name} is required`);
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
};

/** A PEM file as it is, a DER one as PEM. */
const pemFile = (file: string, label: string): string => {
  const data = fs.readFileSync(file);
  return data.includes("-----BEGIN")
    ? data.toString("utf8")
    : toPem(data, label);
};

async function main(args: string[]): Promise<number> {
  const { command, options } = parse(args);
  if (!command) {
    console.error(USAGE);
    return 2;
  }
  // The running service schedules the lists; this process never does.
  process.env.CRL_SCHEDULE_SECONDS = "0";
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
      case "crls": {
        const run = await app.get(CrlScheduler).run();
        for (const signed of run.signed) {
          console.log(`signed ${signed.issuerId} list ${signed.number}`);
        }
        for (const failed of run.failed) {
          console.log(`not signed ${failed.issuerId}: ${failed.message}`);
        }
        for (const published of run.published) {
          console.log(
            published.error
              ? `not published ${published.issuerId} list ${published.number}: ${published.error}`
              : `published ${published.issuerId} list ${published.number}`,
          );
        }
        return run.failed.length || run.published.some((p) => p.error) ? 1 : 0;
      }
      case "import-issuer": {
        const keyFile = one(options, "key");
        const passphraseFile = one(options, "passphrase-file");
        if (Boolean(keyFile) !== Boolean(passphraseFile)) {
          throw new Error("--key and --passphrase-file go together");
        }
        const tier = required(options, "tier") as IssuerTierName;
        const issuer = await app.get(IssuerService).import(principal, {
          id: required(options, "id"),
          tier,
          purpose: one(options, "purpose"),
          number: integerOption(options, "number"),
          generation: integerOption(options, "generation"),
          certificate: fs.readFileSync(
            required(options, "certificate"),
            "utf8",
          ),
          chain: (options.chain ?? []).map((file) =>
            fs.readFileSync(file, "utf8"),
          ),
          maxValidityDays: integerOption(options, "max-validity-days", 825),
          extendedKeyUsages: options.eku ?? [],
          privateKey: keyFile ? fs.readFileSync(keyFile, "utf8") : undefined,
          passphrase: passphraseFile
            ? fs.readFileSync(passphraseFile, "utf8").trim()
            : undefined,
        });
        console.log(`imported ${issuer.id}: ${issuer.subject}`);
        return 0;
      }
      case "import-crl": {
        const crl = await app
          .get(CrlService)
          .import(
            principal,
            required(options, "issuer"),
            pemFile(required(options, "crl"), "X509 CRL"),
          );
        console.log(
          `imported ${crl.issuerId} list ${crl.number} (${crl.entries} serials)`,
        );
        return 0;
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
