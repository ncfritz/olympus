import * as x509 from "@peculiar/x509";
import { execFileSync } from "child_process";
import { createPrivateKey, webcrypto } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CrlScheduler } from "../../src/crls/services/CrlScheduler";
import { parseCrl } from "../../src/pki/crl";
import { OID, parseCertificate, spkiFromPem } from "../../src/pki/x509";
import {
  E2E_DATABASE_URL,
  makeCsr,
  opensslVerify,
  startHarness,
  type Harness,
} from "../support/e2e";

const REPO = path.resolve(__dirname, "../../../../..");
const CA = path.join(REPO, "infra/dev-ca");
const CERTS = path.join(CA, "certs");

/** The dev CA (scripts/dev-ca.sh): XCA's hierarchy in miniature. */
const devCa = () => {
  if (!fs.existsSync(path.join(CERTS, "keys/root-1-g1.p8"))) {
    execFileSync("bash", [path.join(REPO, "scripts/dev-ca.sh")], {
      stdio: "ignore",
    });
  }
};

const read = (...parts: string[]) =>
  fs.readFileSync(path.join(...parts), "utf8");
/** An authority's certificate; dev-ca.sh keeps the intermediates in int-<n>. */
const caCertificate = (name: string) =>
  read(CA, name.replace(/^intermediate-/, "int-"), "ca.crt");

type Imported = {
  imported: {
    id: string;
    issuerId: string;
    serial: string;
    subject: string;
    state: string;
    names: { dns?: string[] };
    keyLocation: string;
    profileId: string;
  }[];
  skipped: { subject?: string; serial?: string; reason: string }[];
};

/**
 * The cutover from XCA (ADR 0020; plan phase 4, sign-off C8), rehearsed
 * with the dev CA standing in for XCA's database: its root and
 * intermediates imported offline, its issuing CAs with their keys (one
 * closed), every certificate they issued, and their last lists, which
 * revoke what they name and continue the numbering.
 */
describe.skipIf(!E2E_DATABASE_URL)("the cutover from XCA", () => {
  let harness: Harness;
  let scheduler: CrlScheduler;
  const server = () => harness.app.getHttpServer();

  const importIssuer = (body: object) =>
    request(server())
      .post("/v1/issuers/import")
      .set("Authorization", harness.admin)
      .send(body);

  const importCertificates = async (
    profileId: string,
    files: string[],
  ): Promise<Imported> =>
    (
      await request(server())
        .post("/v1/certificates/import")
        .set("Authorization", harness.admin)
        .send({
          profileId,
          certificates: files.map((file) => read(CERTS, file)),
        })
        .expect(200)
    ).body as Imported;

  const importList = (issuerId: string, file: string) =>
    request(server())
      .post(`/v1/issuer/${issuerId}/crls`)
      .set("Authorization", harness.admin)
      .send({ crl: read(CERTS, file) });

  beforeAll(async () => {
    devCa();
    harness = await startHarness();
    scheduler = harness.app.get(CrlScheduler);
  });

  afterAll(async () => {
    await harness?.close();
  });

  describe("the CAs", () => {
    it("takes the root and the intermediates offline, certificates only", async () => {
      await importIssuer({
        id: "root-1-g1",
        tier: "root",
        number: 1,
        generation: 1,
        certificate: caCertificate("root"),
        chain: [],
        maxValidityDays: 3650,
        extendedKeyUsages: [],
      }).expect(201);
      const intermediate = (n: number, csr: string) =>
        importIssuer({
          id: `intermediate-${n}-g1`,
          tier: "intermediate",
          number: n,
          generation: 1,
          certificate: caCertificate(`intermediate-${n}`),
          chain: [caCertificate("root")],
          maxValidityDays: 1825,
          extendedKeyUsages: [],
          csr,
        });
      // Its CSR, if given, is its own (ADR 0039): another's is refused.
      await intermediate(1, read(CA, "int-2", "ca.csr")).expect(422);
      for (const n of [1, 2]) {
        await intermediate(n, read(CA, `int-${n}`, "ca.csr")).expect(201);
      }
      const kept = await harness.prisma.issuer.findUniqueOrThrow({
        where: { id: "intermediate-1-g1" },
      });
      expect(kept.csr).not.toBeNull();
      const keys = await harness.prisma.key.findMany({
        where: { purpose: "issuer" },
      });
      expect(keys.map((k) => k.location)).toEqual([
        "offline",
        "offline",
        "offline",
      ]);
    });

    it("takes the issuing CAs with their keys, one of them closed", async () => {
      const issuing = (
        dir: string,
        id: string,
        purpose: string,
        intermediate: string,
        extendedKeyUsages: string[],
        closed = false,
      ) =>
        importIssuer({
          id,
          tier: "issuing",
          purpose,
          number: 1,
          generation: 1,
          certificate: caCertificate(dir),
          chain: [caCertificate(intermediate), caCertificate("root")],
          maxValidityDays: 825,
          extendedKeyUsages,
          privateKey: read(CERTS, "keys", `${id}.p8`),
          passphrase: "olympus",
          closed,
          csr: read(CA, dir, "ca.csr"),
        }).expect(201);
      await issuing(
        "services",
        "service-issuing-1-g1",
        "Service",
        "intermediate-2",
        [OID.clientAuth, OID.serverAuth],
      );
      await issuing(
        "devices",
        "device-issuing-1-g1",
        "Device",
        "intermediate-2",
        [OID.clientAuth],
      );
      await issuing("tls", "tls-issuing-1-g1", "TLS", "intermediate-1", [
        OID.serverAuth,
      ]);
      await issuing(
        "signing",
        "signing-issuing-1-g1",
        "Signing",
        "intermediate-2",
        [OID.codeSigning, OID.emailProtection, OID.documentSigning],
        true,
      );
      const signing = await harness.prisma.issuer.findUniqueOrThrow({
        where: { id: "signing-issuing-1-g1" },
      });
      expect(signing.status).toBe("closed");
    });

    it("takes an issuing CA without path length 0 closed only, to sign its lists (ADR 0041)", async () => {
      // XCA's default CA template sets no path length: one beneath
      // intermediate 2, made as XCA would.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xca-issuing-"));
      const at = (name: string) => path.join(dir, name);
      const env = { ...process.env, KEY_PASSWORD: "xca export" };
      const openssl = (...args: string[]) =>
        execFileSync("openssl", args, { env, stdio: "pipe" });
      fs.writeFileSync(
        at("ext.cnf"),
        [
          "basicConstraints = critical, CA:true",
          "keyUsage = critical, keyCertSign, cRLSign",
          "subjectKeyIdentifier = hash",
          "authorityKeyIdentifier = keyid",
        ].join("\n"),
      );
      openssl(
        "ecparam",
        "-name",
        "prime256v1",
        "-genkey",
        "-noout",
        "-out",
        at("ca.key"),
      );
      openssl(
        "req",
        "-new",
        "-key",
        at("ca.key"),
        "-subj",
        "/CN=ncfritz.net Legacy Issuing CA/O=Olympus Dev",
        "-out",
        at("ca.csr"),
      );
      openssl(
        "x509",
        "-req",
        "-in",
        at("ca.csr"),
        "-days",
        "365",
        "-CA",
        path.join(CA, "int-2", "ca.crt"),
        "-CAkey",
        path.join(CA, "int-2", "ca.key"),
        "-set_serial",
        "0x4101",
        "-extfile",
        at("ext.cnf"),
        "-out",
        at("ca.crt"),
      );
      openssl(
        "pkcs8",
        "-topk8",
        "-v2",
        "aes-256-cbc",
        "-in",
        at("ca.key"),
        "-out",
        at("ca.p8"),
        "-passout",
        "env:KEY_PASSWORD",
      );
      const certificate = read(dir, "ca.crt");
      expect(parseCertificate(certificate).pathLength).toBeUndefined();
      const legacy = (closed: boolean) =>
        importIssuer({
          id: "legacy-issuing-1-g1",
          tier: "issuing",
          purpose: "Legacy",
          number: 1,
          generation: 1,
          certificate,
          chain: [caCertificate("intermediate-2"), caCertificate("root")],
          maxValidityDays: 825,
          extendedKeyUsages: [OID.serverAuth],
          privateKey: read(dir, "ca.p8"),
          passphrase: "xca export",
          closed,
          csr: read(dir, "ca.csr"),
        });
      try {
        await legacy(false).expect(422);
        await legacy(true).expect(201);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      const row = await harness.prisma.issuer.findUniqueOrThrow({
        where: { id: "legacy-issuing-1-g1" },
      });
      expect(row.status).toBe("closed");
      expect(row.pathLength).toBeNull();
      // Its lists are signed with the rest after the cutover.
    });

    it("gives an imported CA its CSR afterwards, its own only (ADR 0039)", async () => {
      const root = await request(server())
        .get("/v1/issuer/root-1-g1")
        .set("Authorization", harness.admin)
        .expect(200);
      expect(root.body.issuer.importedAt).toBeDefined();
      expect(root.body.issuer.csr).toBeUndefined();
      const addCsr = (issuerId: string, csr: string) =>
        request(server())
          .post(`/v1/issuer/${issuerId}/csr`)
          .set("Authorization", harness.admin)
          .send({ csr });
      // XCA made the root without one: one from its key stands in.
      const rootCsr = execFileSync(
        "openssl",
        [
          "req",
          "-new",
          "-key",
          path.join(CA, "root", "ca.key"),
          "-subj",
          "/CN=Olympus Dev Root CA",
        ],
        { encoding: "utf8" },
      );
      await addCsr("root-1-g1", read(CA, "int-1", "ca.csr")).expect(422);
      const added = await addCsr("root-1-g1", rootCsr).expect(200);
      expect(added.body.issuer.csr).toMatch(/BEGIN CERTIFICATE REQUEST/);
      await addCsr("root-1-g1", rootCsr).expect(409);
      await request(server())
        .post("/v1/issuer/root-1-g1/csr")
        .set("Authorization", harness.operator)
        .send({ csr: rootCsr })
        .expect(403);
    });

    it("gives an imported root no shape: what is beneath it is free-form (ADR 0040)", async () => {
      const root = await harness.prisma.issuer.findUniqueOrThrow({
        where: { id: "root-1-g1" },
      });
      expect(root.shape).toBeNull();
    });

    it("reads a key about to be imported without keeping it", async () => {
      const key = {
        format: "pem",
        data: read(CERTS, "keys", "tls-issuing-1-g1.p8"),
        passphrase: "olympus",
      };
      const answer = await request(server())
        .post("/v1/keys/read")
        .set("Authorization", harness.admin)
        .send(key)
        .expect(200);
      const tls = await harness.prisma.issuer.findUniqueOrThrow({
        where: { id: "tls-issuing-1-g1" },
        include: { key: true },
      });
      expect(
        Buffer.from(tls.key.publicKey).equals(
          spkiFromPem(answer.body.publicKey as string),
        ),
      ).toBe(true);
      await request(server())
        .post("/v1/keys/read")
        .set("Authorization", harness.admin)
        .send({ ...key, passphrase: "not it" })
        .expect(400);
      await request(server())
        .post("/v1/keys/read")
        .set("Authorization", harness.operator)
        .send(key)
        .expect(403);
    });

    it("refuses to import an offline CA closed", async () => {
      await importIssuer({
        id: "root-2-g1",
        tier: "root",
        number: 2,
        generation: 1,
        certificate: caCertificate("root"),
        chain: [],
        maxValidityDays: 3650,
        extendedKeyUsages: [],
        closed: true,
      }).expect(400);
    });
  });

  describe("what they issued", () => {
    it("records every certificate under the CA that signed it, with its serial, dates and names", async () => {
      const agents = [
        "dionysus-asset-agent",
        "dionysus-asset-agent-nas",
        "dionysus-metadata-agent",
        "dionysus-search-agent",
        "olympus-notification-agent",
        "svc-revoked",
        "svc-expired",
        "svc-wrong-ca",
      ].map((name) => `agents/${name}.crt`);
      const services = await importCertificates("service", agents);
      expect(services.skipped).toEqual([]);
      expect(services.imported).toHaveLength(8);
      // Signed by the Device CA, whatever its name says: recorded there.
      expect(
        services.imported.find(
          (c) =>
            c.subject.includes("OU=test") &&
            c.issuerId === "device-issuing-1-g1",
        ),
      ).toBeDefined();
      for (const certificate of services.imported) {
        const file = agents.find(
          (f) => parseCertificate(read(CERTS, f)).serial === certificate.serial,
        );
        expect(file).toBeDefined();
        const parsed = parseCertificate(read(CERTS, file!));
        const row = await harness.prisma.certificate.findUniqueOrThrow({
          where: { id: certificate.id },
        });
        expect(row.notBefore).toEqual(parsed.notBefore);
        expect(row.notAfter).toEqual(parsed.notAfter);
        expect(Buffer.from(row.der).equals(Buffer.from(parsed.der))).toBe(true);
      }
      expect(
        services.imported.find(
          (c) =>
            c.serial ===
            parseCertificate(read(CERTS, "agents/svc-expired.crt")).serial,
        )?.state,
      ).toBe("expired");

      const api = await importCertificates("api-server", ["api.crt"]);
      expect(api.imported[0]).toMatchObject({
        issuerId: "service-issuing-1-g1",
        keyLocation: "subscriber",
        names: {
          dns: expect.arrayContaining(["olympus-api", "localhost"]),
        },
      });

      const devices = await importCertificates(
        "device",
        ["dev-valid", "dev-revoked", "dev-expired", "dev-wrong-ca"].map(
          (name) => `devices/${name}.crt`,
        ),
      );
      expect(devices.imported).toHaveLength(4);
      const tls = await importCertificates("internal-tls", [
        "tls/localhost.crt",
        "tls/out-of-bounds.crt",
      ]);
      expect(tls.imported).toHaveLength(2);
    });

    it("adds nothing on a second run, and passes over CAs and strangers", async () => {
      const again = await importCertificates("service", [
        "agents/dionysus-search-agent.crt",
      ]);
      expect(again.imported).toEqual([]);
      expect(again.skipped).toEqual([
        expect.objectContaining({ reason: "Already imported" }),
      ]);

      const chain = await importCertificates("service", ["services-ca.crt"]);
      expect(chain.skipped.map((s) => s.reason)).toEqual([
        "A CA: import it as an issuer",
        "A CA: import it as an issuer",
        "A CA: import it as an issuer",
      ]);

      const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
      const stranger = await x509.X509CertificateGenerator.createSelfSigned({
        serialNumber: "0badc0de",
        name: "CN=stranger",
        keys: (await webcrypto.subtle.generateKey(algorithm, false, [
          "sign",
          "verify",
        ])) as CryptoKeyPair,
        signingAlgorithm: algorithm,
      });
      const response = await request(server())
        .post("/v1/certificates/import")
        .set("Authorization", harness.admin)
        .send({
          profileId: "service",
          certificates: [stranger.toString("pem")],
        })
        .expect(200);
      expect((response.body as Imported).skipped[0].reason).toMatch(
        /Signed by CN=stranger, which is not a CA here/,
      );
    });

    it("is an admin's to do", async () => {
      await request(server())
        .post("/v1/certificates/import")
        .set("Authorization", harness.operator)
        .send({ profileId: "service", certificates: ["x"] })
        .expect(403);
    });

    describe("with their keys and CSRs (ADR 0039)", () => {
      const PASSPHRASE = "bring me";
      /** An agent's key, as XCA exports it: encrypted PKCS#8. */
      const pkcs8 = (name: string) => ({
        format: "pem",
        data: createPrivateKey(read(CERTS, "agents", `${name}.key`))
          .export({
            type: "pkcs8",
            format: "pem",
            cipher: "aes-256-cbc",
            passphrase: PASSPHRASE,
          })
          .toString(),
        passphrase: PASSPHRASE,
      });
      const send = (body: object) =>
        request(server())
          .post("/v1/certificates/import")
          .set("Authorization", harness.admin)
          .send({ profileId: "service", ...body });
      const certificate = (name: string) =>
        read(CERTS, "agents", `${name}.crt`);
      const csr = (name: string) => read(CA, `${name}.csr`);
      const escrowed = async (name: string) =>
        harness.prisma.key.findUniqueOrThrow({
          where: {
            spkiSha256: (
              await harness.prisma.certificate.findFirstOrThrow({
                where: { serial: parseCertificate(certificate(name)).serial },
                include: { enrollment: { include: { key: true } } },
              })
            ).enrollment!.key.spkiSha256,
          },
          include: { enrollment: true },
        });

      it("refuses a CSR without its key, and a key under a CSR-only profile", async () => {
        await send({
          certificates: [certificate("dionysus-search-agent")],
          csr: csr("dionysus-search-agent"),
        }).expect(422);
        await send({
          profileId: "code-signing",
          certificates: [certificate("dionysus-search-agent")],
          key: pkcs8("dionysus-search-agent"),
        }).expect(422);
      });

      it("refuses, keeping nothing, a key none of the certificates have, or another key's CSR", async () => {
        const none = await send({
          certificates: [certificate("minerva-mail-ml")],
          key: pkcs8("dionysus-search-agent"),
        }).expect(422);
        expect(String(none.body.message)).toMatch(/none of these/);
        await send({
          certificates: [certificate("dionysus-search-agent")],
          key: pkcs8("dionysus-search-agent"),
          csr: csr("dionysus-metadata-agent"),
        }).expect(422);
        await send({
          certificates: [certificate("dionysus-search-agent")],
          key: { ...pkcs8("dionysus-search-agent"), passphrase: "not it" },
        }).expect(400);
        // Nothing was recorded, and the signer kept nothing (it would
        // refuse the key below if it had).
        expect((await escrowed("dionysus-search-agent")).location).toBe(
          "subscriber",
        );
        expect(
          await harness.prisma.certificate.count({
            where: {
              serial: parseCertificate(certificate("minerva-mail-ml")).serial,
            },
          }),
        ).toBe(0);
      });

      it("gives a certificate imported as a record its key and CSR, escrowed", async () => {
        const answer = (
          await send({
            certificates: [certificate("dionysus-search-agent")],
            key: pkcs8("dionysus-search-agent"),
            csr: csr("dionysus-search-agent"),
          }).expect(200)
        ).body as Imported & { keyed: Imported["imported"] };
        expect(answer.imported).toEqual([]);
        expect(answer.skipped).toEqual([]);
        expect(answer.keyed).toEqual([
          expect.objectContaining({ keyLocation: "signer" }),
        ]);
        const key = await escrowed("dionysus-search-agent");
        expect(key).toMatchObject({ location: "signer", exportOnce: false });
        expect(key.signerKeyId).toBeTruthy();
        expect(Buffer.from(key.enrollment!.csr!).toString("utf8")).toBe(
          csr("dionysus-search-agent"),
        );
        expect(
          await harness.prisma.auditEvent.count({
            where: { kind: "key.imported", subjectId: key.id },
          }),
        ).toBe(1);

        const again = (
          await send({
            certificates: [certificate("dionysus-search-agent")],
            key: pkcs8("dionysus-search-agent"),
          }).expect(200)
        ).body as Imported;
        expect(again.skipped[0].reason).toMatch(/already escrowed/);
      });

      describe("from the certificate's page", () => {
        const idOf = async (name: string) =>
          (
            await harness.prisma.certificate.findFirstOrThrow({
              where: { serial: parseCertificate(certificate(name)).serial },
            })
          ).id;
        const add = async (
          name: string,
          what: "key" | "csr",
          body: object,
          status: number,
        ) =>
          request(server())
            .post(`/v1/certificate/${await idOf(name)}/${what}`)
            .set("Authorization", harness.admin)
            .send(body)
            .expect(status);
        type Added = {
          certificate: {
            keyLocation: string;
            enrollmentMode?: string;
            hasCsr: boolean;
          };
        };

        it("gives an imported certificate its key and CSR, its own only", async () => {
          await add(
            "dionysus-asset-agent",
            "csr",
            {
              csr: csr("dionysus-asset-agent"),
            },
            422,
          );
          await add(
            "dionysus-asset-agent",
            "key",
            {
              key: pkcs8("dionysus-metadata-agent"),
            },
            422,
          );
          await add(
            "dionysus-asset-agent",
            "key",
            {
              key: pkcs8("dionysus-asset-agent"),
              csr: csr("dionysus-metadata-agent"),
            },
            422,
          );
          const added = (
            await add(
              "dionysus-asset-agent",
              "key",
              {
                key: pkcs8("dionysus-asset-agent"),
                csr: csr("dionysus-asset-agent"),
              },
              200,
            )
          ).body as Added;
          expect(added.certificate).toMatchObject({
            keyLocation: "signer",
            enrollmentMode: "imported",
            hasCsr: true,
          });
          await add(
            "dionysus-asset-agent",
            "key",
            {
              key: pkcs8("dionysus-asset-agent"),
            },
            409,
          );
          await add(
            "dionysus-asset-agent",
            "csr",
            {
              csr: csr("dionysus-asset-agent"),
            },
            409,
          );
        });

        it("takes the CSR afterwards, once the key is escrowed", async () => {
          const keyed = (
            await add(
              "dionysus-metadata-agent",
              "key",
              {
                key: pkcs8("dionysus-metadata-agent"),
              },
              200,
            )
          ).body as Added;
          expect(keyed.certificate).toMatchObject({
            keyLocation: "signer",
            hasCsr: false,
          });
          await add(
            "dionysus-metadata-agent",
            "csr",
            {
              csr: csr("dionysus-asset-agent"),
            },
            422,
          );
          const withCsr = (
            await add(
              "dionysus-metadata-agent",
              "csr",
              {
                csr: csr("dionysus-metadata-agent"),
              },
              200,
            )
          ).body as Added;
          expect(withCsr.certificate.hasCsr).toBe(true);
          expect(
            await harness.prisma.auditEvent.count({
              where: {
                kind: "certificate.csr-added",
                subjectId: await idOf("dionysus-metadata-agent"),
              },
            }),
          ).toBe(1);
        });

        it("is an admin's to do", async () => {
          await request(server())
            .post(`/v1/certificate/${await idOf("dionysus-asset-agent")}/csr`)
            .set("Authorization", harness.operator)
            .send({ csr: csr("dionysus-asset-agent") })
            .expect(403);
        });
      });

      it("passes over a certificate another CA signed, when one CA is named", async () => {
        const answer = (
          await send({
            issuerId: "device-issuing-1-g1",
            certificates: [certificate("minerva-mail-ml")],
          }).expect(200)
        ).body as Imported;
        expect(answer.imported).toEqual([]);
        expect(answer.skipped[0].reason).toBe(
          "Signed by service-issuing-1-g1, not device-issuing-1-g1",
        );
      });

      it("takes a certificate an imported root signed directly", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "direct-"));
        try {
          const key = path.join(dir, "leaf.key");
          const csrFile = path.join(dir, "leaf.csr");
          const crt = path.join(dir, "leaf.crt");
          execFileSync("openssl", [
            "req",
            "-new",
            "-newkey",
            "ec",
            "-pkeyopt",
            "ec_paramgen_curve:P-256",
            "-nodes",
            "-keyout",
            key,
            "-subj",
            "/CN=direct-from-root",
            "-out",
            csrFile,
          ]);
          execFileSync("openssl", [
            "x509",
            "-req",
            "-in",
            csrFile,
            "-CA",
            path.join(CA, "root", "ca.crt"),
            "-CAkey",
            path.join(CA, "root", "ca.key"),
            "-set_serial",
            "0x5eed01",
            "-days",
            "30",
            "-out",
            crt,
          ]);
          const answer = (
            await send({
              issuerId: "root-1-g1",
              certificates: [fs.readFileSync(crt, "utf8")],
            }).expect(200)
          ).body as Imported;
          expect(answer.skipped).toEqual([]);
          expect(answer.imported).toEqual([
            expect.objectContaining({ issuerId: "root-1-g1" }),
          ]);
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      });

      it("imports a new certificate with its key from a PKCS#12 file", async () => {
        const answer = (
          await send({
            certificates: [certificate("minerva-mail-ml")],
            key: {
              format: "pkcs12",
              data: fs
                .readFileSync(path.join(CERTS, "agents", "minerva-mail-ml.p12"))
                .toString("base64"),
              passphrase: "olympus",
            },
          }).expect(200)
        ).body as Imported;
        expect(answer.imported).toEqual([
          expect.objectContaining({ keyLocation: "signer" }),
        ]);
        expect((await escrowed("minerva-mail-ml")).enrollment?.mode).toBe(
          "imported",
        );
      });
    });
  });

  describe("their last lists", () => {
    it("revoke what they name, with XCA's dates, and continue the numbering", async () => {
      const lists: [string, string][] = [
        ["root-1-g1", "root.crl"],
        ["intermediate-1-g1", "intermediate-1.crl"],
        ["intermediate-2-g1", "intermediate-2.crl"],
        ["service-issuing-1-g1", "services.crl"],
        ["device-issuing-1-g1", "devices.crl"],
        ["tls-issuing-1-g1", "tls.crl"],
        ["signing-issuing-1-g1", "signing.crl"],
      ];
      for (const [issuerId, file] of lists) {
        await importList(issuerId, file).expect(201);
      }
      const xcaServices = parseCrl(read(CERTS, "services.crl"));
      const revoked = await harness.prisma.certificate.findFirstOrThrow({
        where: {
          serial: parseCertificate(read(CERTS, "agents/svc-revoked.crt"))
            .serial,
        },
        include: { revocation: true },
      });
      expect(revoked.status).toBe("revoked");
      expect(revoked.revocation?.revokedAt).toEqual(
        xcaServices.entries[0].revokedAt,
      );
      const deviceRevoked = await harness.prisma.certificate.findFirstOrThrow({
        where: {
          serial: parseCertificate(read(CERTS, "devices/dev-revoked.crt"))
            .serial,
        },
      });
      expect(deviceRevoked.status).toBe("revoked");
      expect(await harness.prisma.importedRevocation.count()).toBe(0);
    });

    it("are followed by lists signed here, numbered above XCA's, with the same serials", async () => {
      const run = await scheduler.run();
      expect(run.failed).toEqual([]);
      expect(run.signed.map((s) => s.issuerId).sort()).toEqual([
        "device-issuing-1-g1",
        "legacy-issuing-1-g1",
        "service-issuing-1-g1",
        "signing-issuing-1-g1",
        "tls-issuing-1-g1",
      ]);
      expect(run.published.filter((p) => p.error)).toEqual([]);
      expect(run.published).toHaveLength(8);

      for (const [slug, file] of [
        ["service-issuing-1-g1", "services.crl"],
        ["device-issuing-1-g1", "devices.crl"],
      ]) {
        const xca = parseCrl(read(CERTS, file));
        const ours = parseCrl(
          fs.readFileSync(path.join(harness.published, "crl", `${slug}.crl`)),
        );
        expect(ours.number).toBe(xca.number! + 1n);
        expect(ours.entries.map((e) => e.serial)).toEqual(
          xca.entries.map((e) => e.serial),
        );
      }
      // The offline CAs' lists are XCA's own, published as they were.
      expect(
        fs
          .readFileSync(path.join(harness.published, "crl", "root-1-g1.crl"))
          .equals(parseCrl(read(CERTS, "root.crl")).der),
      ).toBe(true);
    });
  });

  describe("after the cutover", () => {
    it("issues from the imported Service CA, verifying to the old root", async () => {
      const { csr } = await makeCsr("dionysus-search-agent");
      const response = await request(server())
        .post("/v1/certificates")
        .set("Authorization", harness.operator)
        .send({
          profileId: "service",
          subject: {
            commonName: "dionysus-search-agent",
            organizationalUnit: "prod",
          },
          csr,
        })
        .expect(201);
      const certificate = (
        response.body as {
          certificate: { issuerId: string; certificate: string };
        }
      ).certificate;
      expect(certificate.issuerId).toBe("service-issuing-1-g1");
      expect(
        opensslVerify(
          harness.dir,
          caCertificate("root"),
          [caCertificate("services"), caCertificate("intermediate-2")],
          certificate.certificate,
          "sslclient",
        ),
      ).toContain(": OK");
    });

    it("issues nothing from the closed CA", async () => {
      const response = await request(server())
        .post("/v1/certificates")
        .set("Authorization", harness.operator)
        .send({
          profileId: "email",
          subject: { commonName: "Neil" },
          names: { email: ["neil@ncfritz.net"] },
        })
        .expect(422);
      expect((response.body as { message: string }).message).toBe(
        "No active issuing CA for Signing can sign email certificates",
      );
    });

    it("revokes an imported certificate into the next list", async () => {
      const search = await harness.prisma.certificate.findFirstOrThrow({
        where: {
          serial: parseCertificate(
            read(CERTS, "agents/dionysus-search-agent.crt"),
          ).serial,
        },
      });
      await request(server())
        .post(`/v1/certificate/${search.id}/revoke`)
        .set("Authorization", harness.operator)
        .send({ reason: "superseded" })
        .expect(200);
      await scheduler.run();
      const list = parseCrl(
        fs.readFileSync(
          path.join(harness.published, "crl", "service-issuing-1-g1.crl"),
        ),
      );
      expect(list.entries.map((e) => e.serial)).toContain(search.serial);
    });

    it("records every step in an audit chain that verifies", async () => {
      const kinds = (
        await harness.prisma.auditEvent.findMany({ select: { kind: true } })
      ).map((e) => e.kind);
      // 15 as a record, one more with its key (ADR 0039), and one the
      // root signed directly (ADR 0040).
      expect(kinds.filter((k) => k === "certificate.imported")).toHaveLength(
        17,
      );
      // XCA's seven, and one without path length 0 (ADR 0041).
      expect(kinds.filter((k) => k === "issuer.imported")).toHaveLength(8);
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
