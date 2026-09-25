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
 *         [--key <encrypted PKCS#8 file> --passphrase-file <file>] [--closed]
 *   import-certificates --profile <id> --file <PEM bundle or DER>...
 *   import-crl --issuer <slug> --crl <file, PEM or DER>
 *   export-key --certificate <id> --format <pem|pkcs12|pkcs12-legacy>
 *         --reason <text> --out <file> [--passphrase-file <file>]
 *   ceremony --issuer <slug> --key <encrypted PKCS#8 file>
 *         [--passphrase-file <file>] [--plan <JSON file>] [--crl] [--remove-key]
 *
 * A ceremony opens the offline CA's key in the signer, creates the issuing
 * CAs its plan lists ({"issuing": [CreateIssuingIssuerRequest, ...]}),
 * signs its list with --crl, and closes, whatever happened. A passphrase
 * not given as a file is asked for on the terminal (`exec -it`), never an
 * argument; --remove-key deletes the key file once the ceremony is open.
 *
 * The cutover from XCA (docs/guides/harpocrates-cutover.md) is these three
 * in order: the CAs, what they issued, then their last lists, which revoke
 * what they name.
 *
 * A revocation here asks for a new list; the running service's scheduler
 * signs it (this process never schedules anything).
 *
 * It acts as `cli:<user>`, with pki-admin's rights, and everything it does
 * is in the audit log like anything else.
 */
import "source-map-support/register";

import { NestFactory } from "@nestjs/core";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import * as fs from "fs";
import * as os from "os";
import * as readline from "readline";
import { Writable } from "stream";
import { AppModule } from "./AppModule";
import { AuditService } from "./audit/services/AuditService";
import { CeremonyService } from "./ceremonies/services/CeremonyService";
import { PkiRole, type Principal } from "./auth/principal";
import { CertificateImportService } from "./certificates/services/CertificateImportService";
import { CertificateService } from "./certificates/services/CertificateService";
import { readConfig } from "./config/configuration";
import { CrlScheduler } from "./crls/services/CrlScheduler";
import { CrlService } from "./crls/services/CrlService";
import type { IssuerTierName } from "./issuers/issuerNames";
import { IssuerService } from "./issuers/services/IssuerService";
import type {
  ExportFormatName,
  RevocationReasonName,
} from "./model/certificates";
import { CreateIssuingIssuerRequest } from "./model/issuers";
import { toPem } from "./pki/x509";
import { SealService } from "./signer/services/SealService";

type Options = Record<string, string[]>;

/** Flags that take no value. */
const SWITCHES = new Set(["closed", "crl", "remove-key"]);

/** Asked for on the terminal without echoing it. */
const promptSecret = (label: string): Promise<string> => {
  if (!process.stdin.isTTY) {
    return Promise.reject(
      new Error(
        `${label}: no terminal to ask on (docker compose exec -it), and no --passphrase-file`,
      ),
    );
  }
  return new Promise((resolve) => {
    const muted = new Writable({ write: (_chunk, _encoding, done) => done() });
    const rl = readline.createInterface({
      input: process.stdin,
      output: muted,
      terminal: true,
    });
    process.stderr.write(`${label}: `);
    rl.question("", (answer) => {
      rl.close();
      process.stderr.write("\n");
      resolve(answer);
    });
  });
};

const passphraseFor = async (options: Options, label: string) => {
  const file = one(options, "passphrase-file");
  return file ? fs.readFileSync(file, "utf8").trim() : promptSecret(label);
};

/** A ceremony's plan: the issuing CAs it creates, each checked as the API checks it. */
const readPlan = async (
  file: string | undefined,
): Promise<CreateIssuingIssuerRequest[]> => {
  if (!file) return [];
  const plan = JSON.parse(fs.readFileSync(file, "utf8")) as {
    issuing?: unknown[];
  };
  const requests = (plan.issuing ?? []).map((item) =>
    plainToInstance(CreateIssuingIssuerRequest, item),
  );
  for (const request of requests) {
    const errors = await validate(request, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) {
      throw new Error(
        `the plan's issuing CA ${JSON.stringify(item(request))} is invalid: ${errors
          .flatMap((e) => Object.values(e.constraints ?? {}))
          .join("; ")}`,
      );
    }
  }
  return requests;
};

const item = (request: CreateIssuingIssuerRequest) => ({
  purpose: request.purpose,
  number: request.number,
  generation: request.generation,
});

const parse = (args: string[]): { command?: string; options: Options } => {
  const [command, ...rest] = args;
  const options: Options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    if (!flag.startsWith("--")) throw new Error(`unexpected ${flag}`);
    if (SWITCHES.has(flag.slice(2))) {
      (options[flag.slice(2)] ??= []).push("true");
      continue;
    }
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

const USAGE = `usage: cli.js status | issue --profile <id> --cn <name> [...] | revoke --certificate <id> --reason <reason> | audit-verify | crls | import-issuer --id <slug> --tier <tier> [...] | import-certificates --profile <id> --file <file>... | import-crl --issuer <slug> --crl <file> | export-key --certificate <id> --format <format> --reason <text> --out <file> | ceremony --issuer <slug> --key <file> [--plan <file>] [--crl]`;

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
        if (one(options, "passphrase-file") && !keyFile) {
          throw new Error("--passphrase-file is for a --key");
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
          passphrase: keyFile
            ? await passphraseFor(options, "The key's passphrase")
            : undefined,
          closed: one(options, "closed") === "true",
        });
        console.log(`imported ${issuer.id}: ${issuer.subject}`);
        return 0;
      }
      case "import-certificates": {
        const files = options.file ?? [];
        if (files.length === 0) throw new Error("--file is required");
        const result = await app
          .get(CertificateImportService)
          .import(principal, {
            profileId: required(options, "profile"),
            certificates: files.map((file) => {
              const data = fs.readFileSync(file);
              return data.includes("-----BEGIN")
                ? data.toString("utf8")
                : toPem(data, "CERTIFICATE");
            }),
          });
        for (const certificate of result.imported) {
          console.log(
            `imported ${certificate.issuerId} ${certificate.serial} ${certificate.subject} (${certificate.state})`,
          );
        }
        for (const skipped of result.skipped) {
          console.log(
            `skipped ${skipped.serial ?? "?"} ${skipped.subject ?? ""}: ${skipped.reason}`,
          );
        }
        console.error(
          `${result.imported.length} imported, ${result.skipped.length} skipped`,
        );
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
      case "export-key": {
        const out = required(options, "out");
        const exported = await app
          .get(CertificateService)
          .exportKey(principal, required(options, "certificate"), {
            format: required(options, "format") as ExportFormatName,
            reason: required(options, "reason"),
            passphrase: await passphraseFor(
              options,
              "A passphrase for the exported key",
            ),
          });
        fs.writeFileSync(out, Buffer.from(exported.data, "base64"), {
          mode: 0o600,
        });
        console.log(`wrote ${out} (${exported.format}; audited)`);
        return 0;
      }
      case "ceremony": {
        const issuerId = required(options, "issuer");
        const keyFile = required(options, "key");
        const plan = await readPlan(one(options, "plan"));
        const crl = one(options, "crl") === "true";
        if (plan.length === 0 && !crl) {
          throw new Error("nothing to do: give a --plan, --crl, or both");
        }
        const privateKey = fs.readFileSync(keyFile, "utf8");
        const passphrase = await passphraseFor(
          options,
          `${issuerId}'s key passphrase`,
        );
        const ceremonies = app.get(CeremonyService);
        const ceremony = await ceremonies.open(
          principal,
          issuerId,
          privateKey,
          passphrase,
        );
        console.log(`opened ceremony ${ceremony.id} for ${issuerId}`);
        // Once the signer has it: a wrong passphrase leaves the file to retry.
        if (one(options, "remove-key") === "true") fs.rmSync(keyFile);
        try {
          for (const request of plan) {
            const issuer = await ceremonies.createIssuing(
              principal,
              ceremony.id,
              request,
            );
            console.log(`created ${issuer.id}: ${issuer.subject}`);
            console.log(issuer.certificate);
          }
          if (crl) {
            const list = await app
              .get(CrlService)
              .signInCeremony(principal, ceremony.id);
            console.log(
              `signed ${issuerId} list ${list.number}, next update ${list.nextUpdate.toISOString()}; the service publishes it`,
            );
          }
        } finally {
          await ceremonies.close(principal, ceremony.id);
          console.log(`closed ceremony ${ceremony.id}`);
        }
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
