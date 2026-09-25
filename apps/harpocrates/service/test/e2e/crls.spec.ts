import * as x509 from "@peculiar/x509";
import { createPrivateKey, webcrypto, X509Certificate } from "crypto";
import { execFile, execFileSync, spawnSync } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CrlScheduler } from "../../src/crls/services/CrlScheduler";
import { parseCrl } from "../../src/pki/crl";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  EXPORT_PASSPHRASE,
  makeCsr,
  RECOVERY_PASSPHRASE,
  startHarness,
  type Harness,
  type Hierarchy,
} from "../support/e2e";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const REPO = path.resolve(__dirname, "../../../../..");

type List = {
  issuerId: string;
  number: number;
  source: string;
  thisUpdate: string;
  nextUpdate: string;
  entries: number;
  publishedAt?: string;
  publishAttempts: number;
  lastError?: string;
  url: string;
};

/** A DER INTEGER, for a CRL number extension. */
const derInteger = (value: number): Uint8Array<ArrayBuffer> => {
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  if (parseInt(hex.slice(0, 2), 16) & 0x80) hex = `00${hex}`;
  const body = Buffer.from(hex, "hex");
  return new Uint8Array([0x02, body.length, ...body]);
};

/** A list signed outside Harpocrates, as XCA or the offline media would. */
const signElsewhere = async (options: {
  issuerPem: string;
  keyPem: string;
  passphrase?: string;
  number: number;
  serials?: string[];
  nextUpdate?: Date;
}): Promise<string> => {
  const pkcs8 = createPrivateKey({
    key: options.keyPem,
    passphrase: options.passphrase,
  }).export({ type: "pkcs8", format: "der" });
  const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const signingKey = await webcrypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const crl = await x509.X509CrlGenerator.create({
    issuer: new x509.X509Certificate(options.issuerPem).subjectName,
    thisUpdate: new Date(Date.now() - HOUR),
    nextUpdate: options.nextUpdate ?? new Date(Date.now() + 30 * DAY),
    entries: (options.serials ?? []).map((serialNumber) => ({
      serialNumber,
      revocationDate: new Date(Date.now() - DAY),
      reason: x509.X509CrlReason.cessationOfOperation,
    })),
    extensions: [
      new x509.Extension("2.5.29.20", false, derInteger(options.number)),
    ],
    signingKey: signingKey as CryptoKey,
    signingAlgorithm: algorithm,
  });
  return crl.toString("pem");
};

/**
 * Revocation lists end to end (ADR 0020, Serials, revocation and
 * publication; sign-off C5): signed for the online CAs on a schedule and
 * on revocation, in a ceremony for the offline ones, imported when signed
 * elsewhere, written to the published directory and read back through the
 * distribution URL, and retried through a sealed signer and an unreachable
 * host. The scheduler is off; each test runs it.
 */
describe.skipIf(!E2E_DATABASE_URL)("revocation lists", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  let scheduler: CrlScheduler;
  const server = () => harness.app.getHttpServer();

  const lists = async (issuerId: string): Promise<List[]> =>
    (
      (
        await request(server())
          .get(`/v1/issuer/${issuerId}/crls`)
          .set("Authorization", harness.operator)
          .expect(200)
      ).body as { crls: List[] }
    ).crls;

  const published = (slug: string) =>
    fs.readFileSync(path.join(harness.published, "crl", `${slug}.crl`));

  const opensslCrl = (der: Buffer, issuerPem: string): string => {
    const crlFile = path.join(harness.dir, "check.crl");
    const caFile = path.join(harness.dir, "check-ca.pem");
    fs.writeFileSync(crlFile, der);
    fs.writeFileSync(caFile, issuerPem);
    return execFileSync(
      "openssl",
      [
        "crl",
        "-inform",
        "DER",
        "-in",
        crlFile,
        "-CAfile",
        caFile,
        "-noout",
        "-text",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  };

  const issue = async (commonName: string) => {
    const { csr } = await makeCsr(commonName, [commonName]);
    return (
      (
        await request(server())
          .post("/v1/certificates")
          .set("Authorization", harness.operator)
          .send({
            profileId: "internal-tls",
            subject: { commonName },
            names: { dns: [commonName] },
            csr,
          })
          .expect(201)
      ).body as { certificate: { id: string; serial: string } }
    ).certificate;
  };

  const revoke = (certificateId: string, reason = "keyCompromise") =>
    request(server())
      .post(`/v1/certificate/${certificateId}/revoke`)
      .set("Authorization", harness.operator)
      .send({ reason })
      .expect(200);

  const openCeremony = async (issuerId: string, privateKey: string) =>
    (
      (
        await request(server())
          .post("/v1/ceremonies")
          .set("Authorization", harness.admin)
          .send({ issuerId, privateKey, passphrase: EXPORT_PASSPHRASE })
          .expect(201)
      ).body as { ceremony: { id: string } }
    ).ceremony.id;

  beforeAll(async () => {
    harness = await startHarness();
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
    ]);
    scheduler = harness.app.get(CrlScheduler);
  });

  afterAll(async () => {
    await harness?.close();
  });

  describe("an online CA's list", () => {
    it("is signed and published on the first run, valid for 7 days", async () => {
      const run = await scheduler.run();
      expect(run.signed).toEqual([{ issuerId: "tls-issuing-1-g1", number: 1 }]);
      expect(run.published).toEqual([
        { issuerId: "tls-issuing-1-g1", number: 1n },
      ]);
      const [list] = await lists("tls-issuing-1-g1");
      expect(list).toMatchObject({
        number: 1,
        source: "signed",
        entries: 0,
        publishAttempts: 1,
        url: `${harness.distribution.url}/crl/tls-issuing-1-g1.crl`,
      });
      expect(list.publishedAt).toBeDefined();
      expect(Date.parse(list.nextUpdate) - Date.parse(list.thisUpdate)).toBe(
        7 * DAY,
      );

      const text = opensslCrl(
        published("tls-issuing-1-g1"),
        hierarchy.issuing.TLS.certificate,
      );
      expect(text).toContain("X509v3 CRL Number: \n                1");
      expect(text).toContain("No Revoked Certificates.");
      // The CA's own certificate is published beside it, DER, for AIA.
      const certificate = fs.readFileSync(
        path.join(harness.published, "ca", "tls-issuing-1-g1.crt"),
      );
      expect(new X509Certificate(certificate).toString()).toBe(
        new X509Certificate(hierarchy.issuing.TLS.certificate).toString(),
      );
    });

    it("verifies with OpenSSL against the CA", () => {
      const crlFile = path.join(harness.dir, "verify.crl");
      const caFile = path.join(harness.dir, "verify-ca.pem");
      fs.writeFileSync(crlFile, published("tls-issuing-1-g1"));
      fs.writeFileSync(caFile, hierarchy.issuing.TLS.certificate);
      const result = spawnSync(
        "openssl",
        [
          "crl",
          "-inform",
          "DER",
          "-in",
          crlFile,
          "-CAfile",
          caFile,
          "-noout",
          "-verify",
        ],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(0);
      expect(result.stderr + result.stdout).toContain("verify OK");
    });

    it("is not signed again before a day has passed", async () => {
      const run = await scheduler.run();
      expect(run.signed).toEqual([]);
      expect(run.published).toEqual([]);
    });

    it("is signed again on a revocation, one higher, with the serial", async () => {
      const certificate = await issue("revoked.internal.ncfritz.net");
      await revoke(certificate.id);
      const run = await scheduler.run();
      expect(run.signed).toEqual([{ issuerId: "tls-issuing-1-g1", number: 2 }]);
      const parsed = parseCrl(published("tls-issuing-1-g1"));
      expect(parsed.number).toBe(2n);
      expect(parsed.entries).toEqual([
        expect.objectContaining({
          serial: certificate.serial,
          reason: "keyCompromise",
        }),
      ]);
      const [list] = await lists("tls-issuing-1-g1");
      expect(list).toMatchObject({ number: 2, entries: 1 });
    });

    it("is re-signed daily though nothing was revoked", async () => {
      const run = await scheduler.run(new Date(Date.now() + 25 * HOUR));
      expect(run.signed).toEqual([{ issuerId: "tls-issuing-1-g1", number: 3 }]);
      expect(parseCrl(published("tls-issuing-1-g1")).entries).toHaveLength(1);
    });
  });

  describe("publication", () => {
    it("is recorded as failed while the distribution URL is down, and retried", async () => {
      await harness.distribution.stop();
      try {
        await revoke(
          (await issue("down.internal.ncfritz.net")).id,
          "superseded",
        );
        const run = await scheduler.run();
        expect(run.signed).toEqual([
          { issuerId: "tls-issuing-1-g1", number: 4 },
        ]);
        expect(run.published).toEqual([
          {
            issuerId: "tls-issuing-1-g1",
            number: 4n,
            error: expect.stringMatching(
              /tls-issuing-1-g1\.crt is unreachable/,
            ),
          },
        ]);
        const [list] = await lists("tls-issuing-1-g1");
        expect(list.publishedAt).toBeUndefined();
        expect(list.lastError).toMatch(/unreachable/);

        // The retry waits its backoff.
        expect((await scheduler.run()).published).toEqual([]);
        const metrics = await request(server()).get("/metrics").expect(200);
        expect(metrics.text).toMatch(
          /harpocrates_crl_publication_pending_seconds\{issuer="tls-issuing-1-g1",tier="issuing"[^}]*\} \d+/,
        );
        expect(metrics.text).toMatch(
          /harpocrates_crl_publication_failures_total\{issuer="tls-issuing-1-g1"[^}]*\} 1/,
        );
      } finally {
        await harness.distribution.start();
      }
      const retried = await scheduler.run(new Date(Date.now() + 60_000));
      expect(retried.published).toEqual([
        { issuerId: "tls-issuing-1-g1", number: 4n },
      ]);
      expect(parseCrl(published("tls-issuing-1-g1")).number).toBe(4n);
      const kinds = (
        await harness.prisma.auditEvent.findMany({ select: { kind: true } })
      ).map((e) => e.kind);
      expect(kinds.filter((k) => k === "crl.publication-failed")).toHaveLength(
        1,
      );
    });

    it("is refused when the host serves something else", async () => {
      harness.distribution.overrides.set(
        "/crl/tls-issuing-1-g1.crl",
        Buffer.from("not the list"),
      );
      try {
        await revoke(
          (await issue("tampered.internal.ncfritz.net")).id,
          "superseded",
        );
        const run = await scheduler.run();
        expect(run.published[0].error).toMatch(
          /serves something other than what was written/,
        );
      } finally {
        harness.distribution.overrides.clear();
      }
      expect(
        (await scheduler.run(new Date(Date.now() + 60_000))).published[0].error,
      ).toBeUndefined();
    });
  });

  describe("a sealed signer", () => {
    it("misses the list, and it is signed as soon as the signer unseals", async () => {
      const certificate = await issue("sealed.internal.ncfritz.net");
      await request(server())
        .post("/v1/signer/seal")
        .set("Authorization", harness.admin)
        .expect(204);
      await revoke(certificate.id, "superseded");
      const sealed = await scheduler.run();
      expect(sealed.signed).toEqual([]);
      expect(sealed.failed).toEqual([
        expect.objectContaining({
          issuerId: "tls-issuing-1-g1",
          reason: "sealed",
        }),
      ]);
      await request(server())
        .post("/v1/signer/unseal")
        .set("Authorization", harness.admin)
        .send({ passphrase: RECOVERY_PASSPHRASE })
        .expect(204);
      const unsealed = await scheduler.run();
      expect(unsealed.signed).toHaveLength(1);
      expect(
        parseCrl(published("tls-issuing-1-g1")).entries.map((e) => e.serial),
      ).toContain(certificate.serial);
    });
  });

  describe("an offline CA's list", () => {
    it("is signed in a ceremony for 13 months, and published", async () => {
      const ceremonyId = await openCeremony(
        "root-1-g1",
        hierarchy.root.encryptedKey,
      );
      const signed = await request(server())
        .post(`/v1/ceremony/${ceremonyId}/crl`)
        .set("Authorization", harness.admin)
        .expect(201);
      await request(server())
        .delete(`/v1/ceremony/${ceremonyId}`)
        .set("Authorization", harness.admin)
        .expect(204);
      const list = (signed.body as { crl: List }).crl;
      expect(signed.headers.location).toMatch(/\/issuer\/root-1-g1\/crls$/);
      expect(list).toMatchObject({
        issuerId: "root-1-g1",
        number: 1,
        source: "ceremony",
      });
      expect(Date.parse(list.nextUpdate) - Date.parse(list.thisUpdate)).toBe(
        395 * DAY,
      );

      const run = await scheduler.run();
      expect(run.published).toEqual([{ issuerId: "root-1-g1", number: 1n }]);
      expect(
        opensslCrl(published("root-1-g1"), hierarchy.root.certificate),
      ).toContain("CN = ncfritz.net Test Root CA 1 - G1");
    });

    it("refuses a closed ceremony", async () => {
      const ceremony = await harness.prisma.ceremony.findFirstOrThrow({
        where: { closedAt: { not: null } },
      });
      await request(server())
        .post(`/v1/ceremony/${ceremony.id}/crl`)
        .set("Authorization", harness.admin)
        .expect(409);
    });
  });

  describe("an imported list", () => {
    it("is refused when another key signed it", async () => {
      const { privateKey } = await webcrypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const forgedKey = Buffer.from(
        await webcrypto.subtle.exportKey("pkcs8", privateKey),
      );
      const forged = await signElsewhere({
        issuerPem: hierarchy.root.certificate,
        keyPem: `-----BEGIN PRIVATE KEY-----\n${forgedKey.toString("base64")}\n-----END PRIVATE KEY-----\n`,
        number: 50,
      });
      const response = await request(server())
        .post("/v1/issuer/root-1-g1/crls")
        .set("Authorization", harness.admin)
        .send({ crl: forged })
        .expect(422);
      expect((response.body as { message: string }).message).toMatch(
        /signature does not verify/,
      );
    });

    it("is refused when its number is not above the CA's", async () => {
      const crl = await signElsewhere({
        issuerPem: hierarchy.root.certificate,
        keyPem: hierarchy.root.encryptedKey,
        passphrase: EXPORT_PASSPHRASE,
        number: 1,
      });
      await request(server())
        .post("/v1/issuer/root-1-g1/crls")
        .set("Authorization", harness.admin)
        .send({ crl })
        .expect(409);
    });

    it("is refused when it has lapsed", async () => {
      const crl = await signElsewhere({
        issuerPem: hierarchy.root.certificate,
        keyPem: hierarchy.root.encryptedKey,
        passphrase: EXPORT_PASSPHRASE,
        number: 60,
        nextUpdate: new Date(Date.now() - 1000),
      });
      await request(server())
        .post("/v1/issuer/root-1-g1/crls")
        .set("Authorization", harness.admin)
        .send({ crl })
        .expect(422);
    });

    it("is published, continues the numbering, and its serials carry into later lists", async () => {
      const crl = await signElsewhere({
        issuerPem: hierarchy.root.certificate,
        keyPem: hierarchy.root.encryptedKey,
        passphrase: EXPORT_PASSPHRASE,
        number: 70,
        serials: ["0badc0ffee"],
      });
      const imported = await request(server())
        .post("/v1/issuer/root-1-g1/crls")
        .set("Authorization", harness.admin)
        .send({ crl })
        .expect(201);
      expect((imported.body as { crl: List }).crl).toMatchObject({
        number: 70,
        source: "imported",
        entries: 1,
      });
      expect((await scheduler.run()).published).toEqual([
        { issuerId: "root-1-g1", number: 70n },
      ]);
      expect(published("root-1-g1").equals(parseCrl(crl).der)).toBe(true);

      const ceremonyId = await openCeremony(
        "root-1-g1",
        hierarchy.root.encryptedKey,
      );
      const next = await request(server())
        .post(`/v1/ceremony/${ceremonyId}/crl`)
        .set("Authorization", harness.admin)
        .expect(201);
      await request(server())
        .delete(`/v1/ceremony/${ceremonyId}`)
        .set("Authorization", harness.admin)
        .expect(204);
      expect((next.body as { crl: List }).crl).toMatchObject({
        number: 71,
        entries: 1,
      });
      await scheduler.run();
      expect(
        parseCrl(published("root-1-g1")).entries.map((e) => e.serial),
      ).toEqual(["badc0ffee"]);
    });
  });

  describe("the NAS's pull", () => {
    // Asynchronously: the distribution server is in this process.
    const pull = async (env: Record<string, string>) =>
      (
        await promisify(execFile)(
          "bash",
          [path.join(REPO, "infra/nas/crl-pull.sh")],
          { encoding: "utf8", env: { ...process.env, ...env } },
        )
      ).stderr;

    it("fetches, verifies and concatenates a chain's lists, and reloads", async () => {
      const trust = path.join(harness.dir, "trust");
      fs.mkdirSync(trust);
      fs.writeFileSync(
        path.join(trust, "tls-issuing-1-g1.crt"),
        hierarchy.issuing.TLS.certificate,
      );
      fs.writeFileSync(
        path.join(trust, "root-1-g1.crt"),
        hierarchy.root.certificate,
      );
      const out = path.join(harness.dir, "nas", "crl.pem");
      const marker = path.join(harness.dir, "reloaded");
      const env = {
        CRL_BASE_URL: harness.distribution.url,
        CRL_ISSUERS: "tls-issuing-1-g1 root-1-g1",
        CRL_TRUST_DIR: trust,
        CRL_OUT: out,
        CRL_RELOAD: `touch ${marker}`,
      };
      await pull(env);
      const pem = fs.readFileSync(out, "utf8");
      expect(pem.match(/BEGIN X509 CRL/g)).toHaveLength(2);
      expect(fs.existsSync(marker)).toBe(true);

      // Unchanged lists: nothing to swap, no reload.
      fs.rmSync(marker);
      expect(await pull(env)).toContain("unchanged");
      expect(fs.existsSync(marker)).toBe(false);
    });

    it("keeps the previous file and fails loudly on a list that does not verify", async () => {
      const trust = path.join(harness.dir, "trust");
      const out = path.join(harness.dir, "nas", "crl.pem");
      const before = fs.readFileSync(out);
      harness.distribution.overrides.set(
        "/crl/root-1-g1.crl",
        published("tls-issuing-1-g1"),
      );
      try {
        await expect(
          pull({
            CRL_BASE_URL: harness.distribution.url,
            CRL_ISSUERS: "tls-issuing-1-g1 root-1-g1",
            CRL_TRUST_DIR: trust,
            CRL_OUT: out,
            CRL_RELOAD: "false",
          }),
        ).rejects.toThrow(/root-1-g1's list does not verify/);
      } finally {
        harness.distribution.overrides.clear();
      }
      expect(fs.readFileSync(out).equals(before)).toBe(true);
    });
  });

  describe("monitoring", () => {
    it("exposes each published list's next update and the renewal thresholds", async () => {
      await issue("valid.internal.ncfritz.net");
      const metrics = await request(server()).get("/metrics").expect(200);
      expect(metrics.text).toMatch(
        /harpocrates_crl_next_update_timestamp_seconds\{issuer="root-1-g1",tier="root"[^}]*\} \d{10}/,
      );
      expect(metrics.text).toMatch(
        /harpocrates_crl_next_update_timestamp_seconds\{issuer="tls-issuing-1-g1",tier="issuing"[^}]*\} \d{10}/,
      );
      expect(metrics.text).toMatch(
        /harpocrates_profile_renewal_due_days\{profile="internal-tls"[^}]*\} 30/,
      );
      expect(metrics.text).toMatch(
        /certificate_expiry_days\{[^}]*renewal="manual"/,
      );
    });

    it("audits every list signed, imported and published", async () => {
      const kinds = (
        await harness.prisma.auditEvent.findMany({ select: { kind: true } })
      ).map((e) => e.kind);
      expect(kinds).toEqual(
        expect.arrayContaining(["crl.signed", "crl.imported", "crl.published"]),
      );
      const verification = await request(server())
        .get("/v1/audit/verification")
        .set("Authorization", harness.operator)
        .expect(200);
      expect(verification.body).toMatchObject({
        verification: { valid: true },
      });
    });
  });
});
