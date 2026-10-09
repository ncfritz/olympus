import { X509Certificate } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  EXPORT_PASSPHRASE,
  opensslVerify,
  RECOVERY_PASSPHRASE,
  startHarness,
  type Harness,
  type Hierarchy,
} from "../support/e2e";
import { bearer } from "../support/tokens";

/**
 * The CA hierarchy through the API against a real signer and Postgres
 * (ADR 0020): a root created and exported, an intermediate and issuing CAs
 * signed in ceremonies, the seal, and the audit chain over all of it.
 */
describe.skipIf(!E2E_DATABASE_URL)("the hierarchy", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  const server = () => harness.app.getHttpServer();

  beforeAll(async () => {
    harness = await startHarness();
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
      {
        purpose: "Service",
        extendedKeyUsages: [OID.clientAuth, OID.serverAuth],
      },
    ]);
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("names the CAs by tier, purpose and generation", async () => {
    const response = await request(server())
      .get("/v1/issuers")
      .set("Authorization", harness.operator)
      .expect(200);
    const issuers = (
      response.body as {
        issuers: {
          id: string;
          subject: string;
          tier: string;
          status: string;
          offline: boolean;
        }[];
      }
    ).issuers;
    expect(
      issuers.map((i) => [i.id, i.tier, i.status, i.offline]).sort(),
    ).toEqual(
      [
        ["root-1-g1", "root", "active", true],
        ["intermediate-1-g1", "intermediate", "active", true],
        ["tls-issuing-1-g1", "issuing", "active", false],
        ["service-issuing-1-g1", "issuing", "active", false],
      ].sort(),
    );
    const tls = issuers.find((i) => i.id === "tls-issuing-1-g1");
    expect(tls?.subject).toContain("CN=ncfritz.net Test TLS Issuing CA 1 - G1");
  });

  it("chains every issuing CA to the root, as OpenSSL sees it", () => {
    for (const issuing of Object.values(hierarchy.issuing)) {
      const output = opensslVerify(
        harness.dir,
        hierarchy.root.certificate,
        [hierarchy.intermediate.certificate],
        issuing.certificate,
      );
      expect(output).toContain(": OK");
    }
  });

  it("gives each tier its path length and validity", () => {
    const years = (pem: string) => {
      const certificate = new X509Certificate(pem);
      return Math.round(
        (Date.parse(certificate.validTo) - Date.parse(certificate.validFrom)) /
          (365.25 * 86_400_000),
      );
    };
    expect(years(hierarchy.root.certificate)).toBe(20);
    expect(years(hierarchy.intermediate.certificate)).toBe(10);
    expect(years(hierarchy.issuing.TLS.certificate)).toBe(5);
    expect(new X509Certificate(hierarchy.root.certificate).ca).toBe(true);
    expect(new X509Certificate(hierarchy.issuing.TLS.certificate).ca).toBe(
      true,
    );
  });

  it("describes an issuer with its chain up to the root", async () => {
    const response = await request(server())
      .get("/v1/issuer/tls-issuing-1-g1")
      .set("Authorization", harness.operator)
      .expect(200);
    const issuer = (
      response.body as {
        issuer: {
          chain: string[];
          issuingWindowClosesAt: string;
          extendedKeyUsages: string[];
        };
      }
    ).issuer;
    expect(issuer.chain).toEqual([
      hierarchy.intermediate.certificate,
      hierarchy.root.certificate,
    ]);
    expect(issuer.extendedKeyUsages.sort()).toEqual(
      [OID.serverAuth, OID.clientAuth].sort(),
    );
    expect(Date.parse(issuer.issuingWindowClosesAt)).toBeGreaterThan(
      Date.now(),
    );
  });

  it("keeps offline keys out of the signer once the ceremony closes", async () => {
    const status = await request(server())
      .get("/v1/signer/status")
      .set("Authorization", harness.operator)
      .expect(200);
    expect(status.body).toMatchObject({
      status: { initialised: true, sealed: false },
    });
    expect(
      (status.body as { status: { ceremonyId?: string } }).status.ceremonyId,
    ).toBeUndefined();
    const keys = await harness.prisma.key.findMany({
      where: { purpose: "issuer" },
    });
    expect(keys.map((k) => k.location).sort()).toEqual([
      "offline",
      "offline",
      "signer",
      "signer",
    ]);
  });

  it("refuses a second root with the same number and generation", async () => {
    await request(server())
      .post("/v1/issuers/roots")
      .set("Authorization", harness.admin)
      .send({ number: 1, generation: 1, exportPassphrase: EXPORT_PASSPHRASE })
      .expect(409);
  });

  it("refuses a ceremony with the wrong passphrase", async () => {
    const root = await harness.prisma.issuer.findUniqueOrThrow({
      where: { id: "root-1-g1" },
    });
    expect(root.status).toBe("active");
    await request(server())
      .post("/v1/ceremonies")
      .set("Authorization", harness.admin)
      .send({
        issuerId: "root-1-g1",
        privateKey:
          "-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----\n",
        passphrase: "not the passphrase",
      })
      .expect(400);
  });

  it("needs a recent sign-in for a ceremony", async () => {
    await request(server())
      .post("/v1/issuers/roots")
      .set("Authorization", await bearer(["pki-admin"], 3600))
      .send({ number: 2, generation: 1, exportPassphrase: EXPORT_PASSPHRASE })
      .expect(403);
  });

  it("seals, refuses to sign while sealed, and unseals with the passphrase", async () => {
    await request(server())
      .post("/v1/signer/seal")
      .set("Authorization", harness.admin)
      .expect(204);
    await request(server())
      .post("/v1/certificates")
      .set("Authorization", harness.operator)
      .send({
        profileId: "service",
        subject: { commonName: "sealed" },
      })
      .expect(503);
    await request(server())
      .post("/v1/signer/unseal")
      .set("Authorization", harness.admin)
      .send({ passphrase: "the wrong passphrase" })
      .expect(403);
    await request(server())
      .post("/v1/signer/unseal")
      .set("Authorization", harness.admin)
      .send({ passphrase: RECOVERY_PASSPHRASE })
      .expect(204);
  });

  it("records all of it in an audit chain that verifies", async () => {
    const events = await request(server())
      .get("/v1/audit/events")
      .set("Authorization", harness.operator)
      .expect(200);
    const kinds = (events.body as { events: { kind: string }[] }).events.map(
      (e) => e.kind,
    );
    expect(kinds).toEqual(
      expect.arrayContaining([
        "issuer.created",
        "ceremony.opened",
        "ceremony.closed",
        "signer.sealed",
        "signer.unsealed",
      ]),
    );
    const verification = await request(server())
      .get("/v1/audit/verification")
      .set("Authorization", harness.operator)
      .expect(200);
    expect(verification.body).toMatchObject({ verification: { valid: true } });
  });

  it("refuses to change the audit log after the fact", async () => {
    await expect(
      harness.prisma.$executeRawUnsafe(
        `UPDATE audit_events SET reason = 'edited'`,
      ),
    ).rejects.toThrow();
    await expect(
      harness.prisma.$executeRawUnsafe(`DELETE FROM audit_events`),
    ).rejects.toThrow();
  });
});
