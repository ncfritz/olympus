import { createHash, X509Certificate } from "crypto";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  makeCsr,
  opensslVerify,
  startHarness,
  type Harness,
  type Hierarchy,
} from "../support/e2e";
import { bearer } from "../support/tokens";

type Issued = {
  id: string;
  issuerId: string;
  serial: string;
  subject: string;
  names: { dns?: string[] };
  state: string;
  keyLocation: string;
  keyAlgorithm: string;
  renewsId?: string;
  renewedById?: string;
  certificate: string;
  chain: string[];
};

const spkiOf = (pem: string) =>
  createHash("sha256")
    .update(
      new X509Certificate(pem).publicKey.export({
        type: "spki",
        format: "der",
      }),
    )
    .digest("hex");

/**
 * Issuance end to end (ADR 0020): profiles over the real hierarchy, CSR
 * and generated keys, one key per request, renewal that reuses or
 * replaces the key, revocation of a compromised key's whole lineage, and
 * escrow export.
 */
describe.skipIf(!E2E_DATABASE_URL)("certificates", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  const server = () => harness.app.getHttpServer();

  const create = (body: object, token = harness.operator) =>
    request(server())
      .post("/v1/certificates")
      .set("Authorization", token)
      .send(body);

  const issued = (response: request.Response) =>
    (response.body as { certificate: Issued }).certificate;

  beforeAll(async () => {
    harness = await startHarness();
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
      {
        purpose: "Service",
        extendedKeyUsages: [OID.clientAuth, OID.serverAuth],
      },
      {
        purpose: "Signing",
        extendedKeyUsages: [
          OID.codeSigning,
          OID.emailProtection,
          OID.documentSigning,
        ],
      },
    ]);
  });

  afterAll(async () => {
    await harness?.close();
  });

  describe("issuing from a CSR", () => {
    it("certifies the subscriber's key under the profile, verifiable by OpenSSL", async () => {
      const { csr } = await makeCsr("ignored by the profile", [
        "nas.internal.ncfritz.net",
      ]);
      const response = await create({
        profileId: "internal-tls",
        subject: { commonName: "nas.internal.ncfritz.net" },
        names: { dns: ["nas.internal.ncfritz.net"] },
        csr,
      }).expect(201);
      const certificate = issued(response);
      expect(response.headers.location).toMatch(
        new RegExp(`/certificate/${certificate.id}$`),
      );
      expect(certificate).toMatchObject({
        issuerId: "tls-issuing-1-g1",
        state: "valid",
        keyLocation: "subscriber",
        keyAlgorithm: "P-256",
        names: { dns: ["nas.internal.ncfritz.net"] },
      });
      expect(certificate.subject).toBe(
        "CN=nas.internal.ncfritz.net,O=ncfritz.net",
      );
      expect(certificate.chain).toEqual([
        hierarchy.issuing.TLS.certificate,
        hierarchy.intermediate.certificate,
        hierarchy.root.certificate,
      ]);
      const output = opensslVerify(
        harness.dir,
        hierarchy.root.certificate,
        certificate.chain.slice(0, -1),
        certificate.certificate,
        "sslserver",
      );
      expect(output).toContain(": OK");
      const parsed = new X509Certificate(certificate.certificate);
      expect(parsed.subjectAltName).toBe("DNS:nas.internal.ncfritz.net");
      expect(
        (Date.parse(parsed.validTo) - Date.parse(parsed.validFrom)) /
          86_400_000,
      ).toBeCloseTo(90, 0);
    });

    it("refuses a profile that needs names without them", async () => {
      const { csr } = await makeCsr("nameless");
      await create({
        profileId: "internal-tls",
        subject: { commonName: "nameless" },
        csr,
      }).expect(422);
    });

    it("refuses names the issuing CA may not sign", async () => {
      const { csr } = await makeCsr("mail", []);
      await create({
        profileId: "internal-tls",
        subject: { commonName: "mail" },
        names: { email: ["neil@ncfritz.net"] },
        csr,
      }).expect(422);
    });

    it("refuses a CSR whose signature does not verify", async () => {
      const { csr } = await makeCsr("tampered", [
        "tampered.internal.ncfritz.net",
      ]);
      const der = Buffer.from(
        csr.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""),
        "base64",
      );
      der[der.length - 5] ^= 0xff;
      const pem = `-----BEGIN CERTIFICATE REQUEST-----\n${der
        .toString("base64")
        .match(/.{1,64}/g)
        ?.join("\n")}\n-----END CERTIFICATE REQUEST-----\n`;
      await create({
        profileId: "internal-tls",
        subject: { commonName: "tampered.internal.ncfritz.net" },
        names: { dns: ["tampered.internal.ncfritz.net"] },
        csr: pem,
      }).expect(422);
    });

    it("refuses a profile that only generates keys", async () => {
      const { csr } = await makeCsr("mail");
      await create({
        profileId: "email",
        subject: { commonName: "Neil Fritz" },
        names: { email: ["neil@ncfritz.net"] },
        csr,
      }).expect(422);
    });

    it("refuses a profile whose CA does not exist yet", async () => {
      await create({
        profileId: "device",
        subject: { commonName: "Neil's iPhone" },
      }).expect(422);
    });
  });

  describe("one key, one request", () => {
    it("reissues for the same request, and refuses the key for another", async () => {
      const { csr, keys } = await makeCsr("git", ["git.internal.ncfritz.net"]);
      const body = {
        profileId: "internal-tls",
        subject: { commonName: "git.internal.ncfritz.net" },
        names: { dns: ["git.internal.ncfritz.net"] },
        csr,
      };
      const first = issued(await create(body).expect(201));
      const second = issued(await create(body).expect(201));
      expect(second.id).not.toBe(first.id);
      expect(spkiOf(second.certificate)).toBe(spkiOf(first.certificate));

      const other = await makeCsr("wiki", ["wiki.internal.ncfritz.net"], keys);
      await create({
        profileId: "internal-tls",
        subject: { commonName: "wiki.internal.ncfritz.net" },
        names: { dns: ["wiki.internal.ncfritz.net"] },
        csr: other.csr,
      }).expect(409);

      const enrollments = await harness.prisma.enrollment.count({
        where: { key: { spkiSha256: spkiOf(first.certificate) } },
      });
      expect(enrollments).toBe(1);
    });
  });

  describe("generated keys", () => {
    let service: Issued;

    beforeAll(async () => {
      service = issued(
        await create({
          profileId: "service",
          subject: { commonName: "minerva", organizationalUnit: "production" },
        }).expect(201),
      );
    });

    it("escrows the key in the signer", () => {
      expect(service).toMatchObject({
        issuerId: "service-issuing-1-g1",
        keyLocation: "signer",
        keyAlgorithm: "P-256",
      });
      expect(service.subject).toBe("CN=minerva,OU=production,O=ncfritz.net");
      expect(
        opensslVerify(
          harness.dir,
          hierarchy.root.certificate,
          service.chain.slice(0, -1),
          service.certificate,
          "sslclient",
        ),
      ).toContain(": OK");
    });

    it("downloads as PEM, DER, and a chain without the root", async () => {
      const pem = await request(server())
        .get(`/v1/certificate/${service.id}/download`)
        .set("Authorization", harness.operator)
        .expect(200);
      expect(pem.text).toBe(service.certificate);
      expect(pem.headers["content-disposition"]).toContain(".pem");

      const der = await request(server())
        .get(`/v1/certificate/${service.id}/download?format=der`)
        .set("Authorization", harness.operator)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(new X509Certificate(der.body as Buffer).toString()).toBe(
        new X509Certificate(service.certificate).toString(),
      );

      const chain = await request(server())
        .get(`/v1/certificate/${service.id}/download?format=chain`)
        .set("Authorization", harness.operator)
        .expect(200);
      expect(chain.text).toBe(
        [
          service.certificate,
          hierarchy.issuing.Service.certificate,
          hierarchy.intermediate.certificate,
        ].join(""),
      );
    });

    it("exports the key only to an admin who signed in recently", async () => {
      const body = {
        format: "pkcs12",
        passphrase: "export pass",
        reason: "restore the host",
      };
      await request(server())
        .post(`/v1/certificate/${service.id}/key-export`)
        .set("Authorization", harness.operator)
        .send(body)
        .expect(403);
      await request(server())
        .post(`/v1/certificate/${service.id}/key-export`)
        .set("Authorization", await bearer(["pki-admin"], 3600))
        .send(body)
        .expect(403);
      const exported = await request(server())
        .post(`/v1/certificate/${service.id}/key-export`)
        .set("Authorization", harness.admin)
        .send(body)
        .expect(200);
      const result = exported.body as {
        format: string;
        fileName: string;
        data: string;
      };
      expect(result).toMatchObject({
        format: "pkcs12",
        fileName: "minerva.p12",
      });
      const file = path.join(harness.dir, "minerva.p12");
      fs.writeFileSync(file, Buffer.from(result.data, "base64"));
      const certificates = execFileSync(
        "openssl",
        ["pkcs12", "-in", file, "-passin", "pass:export pass", "-nokeys"],
        { encoding: "utf8" },
      );
      expect(certificates.match(/BEGIN CERTIFICATE/g)).toHaveLength(4);
      expect(await harness.prisma.escrowExport.count()).toBe(1);
    });

    it("refuses to export a key only the subscriber has", async () => {
      const { csr } = await makeCsr("csr", []);
      const certificate = issued(
        await create({
          profileId: "service",
          subject: { commonName: "csr-service" },
          csr,
        }).expect(201),
      );
      await request(server())
        .post(`/v1/certificate/${certificate.id}/key-export`)
        .set("Authorization", harness.admin)
        .send({
          format: "pem",
          passphrase: "export pass",
          reason: "restore the host",
        })
        .expect(422);
    });

    it("renews with the same key while it is young", async () => {
      const renewed = issued(
        await request(server())
          .post(`/v1/certificate/${service.id}/renew`)
          .set("Authorization", harness.operator)
          .send({})
          .expect(201),
      );
      expect(renewed.renewsId).toBe(service.id);
      expect(renewed.subject).toBe(service.subject);
      expect(spkiOf(renewed.certificate)).toBe(spkiOf(service.certificate));
      const before = await request(server())
        .get(`/v1/certificate/${service.id}`)
        .set("Authorization", harness.operator)
        .expect(200);
      expect(issued(before).renewedById).toBe(renewed.id);
      // A certificate is renewed once.
      await request(server())
        .post(`/v1/certificate/${service.id}/renew`)
        .set("Authorization", harness.operator)
        .send({})
        .expect(409);
    });
  });

  describe("renewing with a new key", () => {
    it("starts a new request that replaces the old one", async () => {
      const first = await makeCsr("ci", ["ci.internal.ncfritz.net"]);
      const original = issued(
        await create({
          profileId: "internal-tls",
          subject: { commonName: "ci.internal.ncfritz.net" },
          names: { dns: ["ci.internal.ncfritz.net"] },
          csr: first.csr,
        }).expect(201),
      );
      const next = await makeCsr("ci", ["ci.internal.ncfritz.net"]);
      const renewed = issued(
        await request(server())
          .post(`/v1/certificate/${original.id}/renew`)
          .set("Authorization", harness.operator)
          .send({ csr: next.csr })
          .expect(201),
      );
      expect(renewed.renewsId).toBe(original.id);
      expect(spkiOf(renewed.certificate)).not.toBe(
        spkiOf(original.certificate),
      );
      const enrollment = await harness.prisma.enrollment.findFirstOrThrow({
        where: { certificates: { some: { id: renewed.id } } },
        include: { replaces: { include: { certificates: true } } },
      });
      expect(enrollment.replaces?.certificates.map((c) => c.id)).toContain(
        original.id,
      );
    });
  });

  describe("revoking", () => {
    it("revokes one certificate for a reason that is not the key", async () => {
      const certificate = issued(
        await create({
          profileId: "service",
          subject: { commonName: "retired" },
        }).expect(201),
      );
      const response = await request(server())
        .post(`/v1/certificate/${certificate.id}/revoke`)
        .set("Authorization", harness.operator)
        .send({ reason: "cessationOfOperation", comment: "retired the host" })
        .expect(200);
      const revoked = (
        response.body as {
          certificates: (Issued & {
            revocation: { reason: string; principal: string };
          })[];
        }
      ).certificates;
      expect(revoked).toHaveLength(1);
      expect(revoked[0]).toMatchObject({
        state: "revoked",
        revocation: {
          reason: "cessationOfOperation",
          principal: "user:user-1",
        },
      });
      await request(server())
        .post(`/v1/certificate/${certificate.id}/revoke`)
        .set("Authorization", harness.operator)
        .send({ reason: "unspecified" })
        .expect(409);
      // Its escrowed key went with its last valid certificate.
      const key = await harness.prisma.key.findFirstOrThrow({
        where: {
          enrollment: { certificates: { some: { id: certificate.id } } },
        },
      });
      expect(key.destroyedAt).not.toBeNull();
      await request(server())
        .post(`/v1/certificate/${certificate.id}/renew`)
        .set("Authorization", harness.operator)
        .send({})
        .expect(409);
    });

    it("revokes a compromised key's whole lineage and never certifies it again", async () => {
      const { csr } = await makeCsr("vpn", ["vpn.internal.ncfritz.net"]);
      const body = {
        profileId: "internal-tls",
        subject: { commonName: "vpn.internal.ncfritz.net" },
        names: { dns: ["vpn.internal.ncfritz.net"] },
        csr,
      };
      const first = issued(await create(body).expect(201));
      const renewed = issued(
        await request(server())
          .post(`/v1/certificate/${first.id}/renew`)
          .set("Authorization", harness.operator)
          .send({ csr })
          .expect(201),
      );
      expect(spkiOf(renewed.certificate)).toBe(spkiOf(first.certificate));

      const response = await request(server())
        .post(`/v1/certificate/${renewed.id}/revoke`)
        .set("Authorization", harness.operator)
        .send({ reason: "keyCompromise" })
        .expect(200);
      const revoked = (response.body as { certificates: Issued[] })
        .certificates;
      expect(revoked.map((c) => c.id).sort()).toEqual(
        [first.id, renewed.id].sort(),
      );
      expect(revoked.every((c) => c.state === "revoked")).toBe(true);

      await create(body).expect(422);
      const key = await harness.prisma.key.findUniqueOrThrow({
        where: { spkiSha256: spkiOf(first.certificate) },
      });
      expect(key.blockedAt).not.toBeNull();
    });
  });

  describe("listing", () => {
    it("filters by state, profile and text, a page at a time", async () => {
      const revoked = await request(server())
        .get("/v1/certificates?state=revoked")
        .set("Authorization", harness.operator)
        .expect(200);
      const revokedList = (revoked.body as { certificates: Issued[] })
        .certificates;
      expect(revokedList.length).toBeGreaterThanOrEqual(3);
      expect(revokedList.every((c) => c.state === "revoked")).toBe(true);

      const search = await request(server())
        .get("/v1/certificates?search=nas.internal")
        .set("Authorization", harness.operator)
        .expect(200);
      expect(
        (search.body as { certificates: Issued[] }).certificates.map(
          (c) => c.subject,
        ),
      ).toEqual(["CN=nas.internal.ncfritz.net,O=ncfritz.net"]);

      const page = await request(server())
        .get("/v1/certificates?profileId=internal-tls&pageSize=2")
        .set("Authorization", harness.operator)
        .expect(200);
      const body = page.body as { certificates: Issued[]; count: number };
      expect(body.certificates).toHaveLength(2);
      expect(body.count).toBeGreaterThan(2);
      const next = await request(server())
        .get("/v1/certificates?profileId=internal-tls&pageSize=2&startPage=1")
        .set("Authorization", harness.operator)
        .expect(200);
      const ids = (next.body as { certificates: Issued[] }).certificates.map(
        (c) => c.id,
      );
      expect(ids).toHaveLength(2);
      expect(ids).not.toContain(body.certificates[0].id);
    });
  });

  describe("the record", () => {
    it("counts issuance and refusals for Prometheus", async () => {
      const metrics = await request(server()).get("/metrics").expect(200);
      expect(metrics.text).toMatch(
        /harpocrates_certificates_issued_total\{[^}]*issuer="tls-issuing-1-g1"[^}]*\} [1-9]/,
      );
      expect(metrics.text).toMatch(/harpocrates_refusals_total\{[^}]*\} [1-9]/);
      expect(metrics.text).toMatch(
        /harpocrates_revocations_total\{[^}]*reason="keyCompromise"[^}]*\} 2/,
      );
      expect(metrics.text).toMatch(/harpocrates_signer_sealed\{[^}]*\} 0/);
    });

    it("audits every issuance, refusal, export and revocation in a chain that verifies", async () => {
      const kinds = (
        await harness.prisma.auditEvent.findMany({ select: { kind: true } })
      ).map((e) => e.kind);
      expect(kinds).toEqual(
        expect.arrayContaining([
          "certificate.issued",
          "certificate.renewed",
          "certificate.revoked",
          "request.refused",
          "key.generated",
          "key.exported",
          "key.blocked",
          "key.destroyed",
        ]),
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
