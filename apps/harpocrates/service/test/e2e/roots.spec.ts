import { X509Certificate } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OID } from "../../src/pki/x509";
import {
  E2E_DATABASE_URL,
  EXPORT_PASSPHRASE,
  startHarness,
  type Harness,
} from "../support/e2e";

type Created = {
  issuer: {
    id: string;
    subject: string;
    certificate: string;
    shape?: string;
    pathLength?: number;
    organization?: string;
    provedAt?: string;
    discardedAt?: string;
    status: string;
    notAfter: string;
  };
  encryptedKey: string;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Roots and their shapes (ADR 0032), through the API against a real signer
 * and Postgres: settings left at their defaults or overridden, the backup
 * proved by the first ceremony, which signs the first list, discarding a
 * root that signed nothing, a two-tier root's issuing CAs, and a root that
 * signs leaves directly.
 */
describe.skipIf(!E2E_DATABASE_URL)("roots", () => {
  let harness: Harness;
  const server = () => harness.app.getHttpServer();

  const createRoot = async (body: Record<string, unknown>) =>
    (
      await request(server())
        .post("/v1/issuers/roots")
        .set("Authorization", harness.admin)
        .send({ generation: 1, exportPassphrase: EXPORT_PASSPHRASE, ...body })
        .expect(201)
    ).body as Created;

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

  const closeCeremony = (ceremonyId: string) =>
    request(server())
      .delete(`/v1/ceremony/${ceremonyId}`)
      .set("Authorization", harness.admin)
      .expect(204);

  const attributes = async (kind: string, subjectId: string) => {
    const event = await harness.prisma.auditEvent.findFirstOrThrow({
      where: { kind, subjectId },
      include: { attributes: true },
      orderBy: { sequence: "desc" },
    });
    return Object.fromEntries(event.attributes.map((a) => [a.name, a.value]));
  };

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await harness?.close();
  });

  describe("a three-tier root with overridden settings", () => {
    let root: Created;

    beforeAll(async () => {
      root = await createRoot({
        number: 1,
        purpose: "Dev",
        organization: "Example Lab",
        validityDays: 5475,
        nameConstraints: { permitted: { dns: ["dev.example.test"] } },
      });
    });

    it("is named from its purpose and organisation, and says what changed", async () => {
      expect(root.issuer).toMatchObject({
        id: "dev-root-1-g1",
        subject: "CN=Example Lab Dev Root CA 1 - G1,O=Example Lab",
        shape: "three_tier",
        pathLength: 2,
        organization: "Example Lab",
      });
      expect(root.issuer.provedAt).toBeUndefined();
      const certificate = new X509Certificate(root.issuer.certificate);
      const days =
        (Date.parse(certificate.validTo) - Date.parse(certificate.validFrom)) /
        DAY;
      expect(Math.round(days)).toBe(5475);
      expect(await attributes("issuer.created", root.issuer.id)).toMatchObject({
        shape: "three_tier",
        overrides: "organization,validityDays,nameConstraints",
      });
    });

    it("proves its backup and signs its first list when its first ceremony opens", async () => {
      const ceremonyId = await openCeremony(root.issuer.id, root.encryptedKey);
      const described = await request(server())
        .get(`/v1/issuer/${root.issuer.id}`)
        .set("Authorization", harness.operator)
        .expect(200);
      expect((described.body as Created).issuer.provedAt).toBeDefined();
      const crls = await harness.prisma.crl.findMany({
        where: { issuerId: root.issuer.id },
      });
      expect(crls.map((c) => [c.number, c.source])).toEqual([[1n, "ceremony"]]);

      const intermediate = (
        await request(server())
          .post(`/v1/ceremony/${ceremonyId}/intermediates`)
          .set("Authorization", harness.admin)
          .send({
            number: 1,
            generation: 1,
            purpose: "Servers",
            exportPassphrase: EXPORT_PASSPHRASE,
          })
          .expect(201)
      ).body as Created;
      expect(intermediate.issuer.subject).toBe(
        "CN=Example Lab Servers Intermediate CA 1 - G1,O=Example Lab",
      );
      expect(intermediate.issuer.organization).toBe("Example Lab");

      // A validity past the root's is refused, not quietly shortened.
      await request(server())
        .post(`/v1/ceremony/${ceremonyId}/intermediates`)
        .set("Authorization", harness.admin)
        .send({
          number: 2,
          generation: 1,
          validityDays: 6000,
          exportPassphrase: EXPORT_PASSPHRASE,
        })
        .expect(422);
      // So is an issuing CA: a three-tier root signs intermediates.
      await request(server())
        .post(`/v1/ceremony/${ceremonyId}/issuing`)
        .set("Authorization", harness.admin)
        .send({
          purpose: "TLS",
          number: 1,
          generation: 1,
          maxValidityDays: 398,
          extendedKeyUsages: [OID.serverAuth],
        })
        .expect(422);
      await closeCeremony(ceremonyId);
    });

    it("refuses a subject that was used before", async () => {
      await request(server())
        .post("/v1/issuers/roots")
        .set("Authorization", harness.admin)
        .send({
          number: 9,
          generation: 1,
          subject: root.issuer.subject,
          exportPassphrase: EXPORT_PASSPHRASE,
        })
        .expect(409);
    });
  });

  describe("a root that has signed nothing", () => {
    it("is discarded, and cannot open a ceremony after", async () => {
      const root = await createRoot({ number: 7, purpose: "Spare" });
      const discarded = await request(server())
        .post(`/v1/issuer/${root.issuer.id}/discard`)
        .set("Authorization", harness.admin)
        .expect(200);
      expect((discarded.body as Created).issuer).toMatchObject({
        status: "revoked",
      });
      expect((discarded.body as Created).issuer.discardedAt).toBeDefined();
      await request(server())
        .post("/v1/ceremonies")
        .set("Authorization", harness.admin)
        .send({
          issuerId: root.issuer.id,
          privateKey: root.encryptedKey,
          passphrase: EXPORT_PASSPHRASE,
        })
        .expect(422);
    });

    it("but not once it has signed its list", async () => {
      const root = await createRoot({ number: 8, purpose: "Spare" });
      await closeCeremony(
        await openCeremony(root.issuer.id, root.encryptedKey),
      );
      await request(server())
        .post(`/v1/issuer/${root.issuer.id}/discard`)
        .set("Authorization", harness.admin)
        .expect(409);
    });
  });

  describe("a two-tier root", () => {
    it("signs issuing CAs, not intermediates", async () => {
      const root = await createRoot({
        number: 1,
        purpose: "Lab",
        shape: "two_tier",
      });
      expect(root.issuer).toMatchObject({ shape: "two_tier", pathLength: 1 });
      const ceremonyId = await openCeremony(root.issuer.id, root.encryptedKey);
      const issuing = (
        await request(server())
          .post(`/v1/ceremony/${ceremonyId}/issuing`)
          .set("Authorization", harness.admin)
          .send({
            purpose: "Lab TLS",
            number: 1,
            generation: 1,
            maxValidityDays: 398,
            extendedKeyUsages: [OID.serverAuth],
          })
          .expect(201)
      ).body as { issuer: { id: string; certificate: string } };
      expect(
        new X509Certificate(issuing.issuer.certificate).checkIssued(
          new X509Certificate(root.issuer.certificate),
        ),
      ).toBe(true);
      await request(server())
        .post(`/v1/ceremony/${ceremonyId}/intermediates`)
        .set("Authorization", harness.admin)
        .send({ number: 1, generation: 1, exportPassphrase: EXPORT_PASSPHRASE })
        .expect(422);
      await closeCeremony(ceremonyId);
    });
  });

  describe("a root that signs directly", () => {
    let root: Created;
    let ceremonyId: string;

    beforeAll(async () => {
      root = await createRoot({
        number: 1,
        purpose: "Bespoke",
        shape: "direct",
      });
      ceremonyId = await openCeremony(root.issuer.id, root.encryptedKey);
    });

    afterAll(async () => {
      await closeCeremony(ceremonyId);
    });

    it("issues a leaf with the key identifiers and nothing else", async () => {
      expect(root.issuer).toMatchObject({ shape: "direct", pathLength: 0 });
      const created = await request(server())
        .post(`/v1/ceremony/${ceremonyId}/certificates`)
        .set("Authorization", harness.admin)
        .send({ subject: { commonName: "bespoke-1" }, validityDays: 90 })
        .expect(201);
      const certificate = (
        created.body as { certificate: { certificate: string; id: string } }
      ).certificate;
      const parsed = new X509Certificate(certificate.certificate);
      expect(
        parsed.checkIssued(new X509Certificate(root.issuer.certificate)),
      ).toBe(true);
      expect(parsed.ca).toBe(false);
      // Node lists no key usage, no SANs and no AIA for it.
      expect(parsed.keyUsage).toBeUndefined();
      expect(parsed.subjectAltName).toBeUndefined();
      expect(parsed.infoAccess).toBeUndefined();
      const days =
        (Date.parse(parsed.validTo) - Date.parse(parsed.validFrom)) / DAY;
      expect(Math.round(days)).toBe(90);
    });

    it("exports a key that is not escrowed once, then never again", async () => {
      const created = await request(server())
        .post(`/v1/ceremony/${ceremonyId}/certificates`)
        .set("Authorization", harness.admin)
        .send({ subject: { commonName: "bespoke-2" }, escrow: false })
        .expect(201);
      const id = (created.body as { certificate: { id: string } }).certificate
        .id;
      const body = {
        format: "pem",
        passphrase: "export passphrase",
        reason: "hand it over",
      };
      await request(server())
        .post(`/v1/certificate/${id}/key-export`)
        .set("Authorization", harness.admin)
        .send(body)
        .expect(200);
      await request(server())
        .post(`/v1/certificate/${id}/key-export`)
        .set("Authorization", harness.admin)
        .send(body)
        .expect(409);
    });

    it("signs no CA, and its profile is not issued outside a ceremony", async () => {
      await request(server())
        .post(`/v1/ceremony/${ceremonyId}/intermediates`)
        .set("Authorization", harness.admin)
        .send({ number: 1, generation: 1, exportPassphrase: EXPORT_PASSPHRASE })
        .expect(422);
      await request(server())
        .post("/v1/certificates")
        .set("Authorization", harness.admin)
        .send({
          profileId: "direct-minimal",
          subject: { commonName: "outside" },
        })
        .expect(422);
    });
  });
});

describe.skipIf(!E2E_DATABASE_URL)("an empty signer", () => {
  let harness: Harness;
  const server = () => harness.app.getHttpServer();

  beforeAll(async () => {
    harness = await startHarness({ initialise: false });
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("is initialised once through the API, and the unseal key shown once", async () => {
    const before = await request(server())
      .get("/v1/signer/status")
      .set("Authorization", harness.operator)
      .expect(200);
    expect(before.body).toMatchObject({
      status: { initialised: false, sealed: true },
    });
    await request(server())
      .post("/v1/signer/initialise")
      .set("Authorization", harness.operator)
      .send({ passphrase: "a long recovery passphrase" })
      .expect(403);
    const initialised = await request(server())
      .post("/v1/signer/initialise")
      .set("Authorization", harness.admin)
      .send({ passphrase: "a long recovery passphrase" })
      .expect(201);
    expect(initialised.headers["cache-control"]).toBe("no-store");
    expect(
      Buffer.from(
        (initialised.body as { unsealKey: string }).unsealKey,
        "base64",
      ),
    ).toHaveLength(32);
    const after = await request(server())
      .get("/v1/signer/status")
      .set("Authorization", harness.operator)
      .expect(200);
    expect(after.body).toMatchObject({
      status: { initialised: true, sealed: false },
    });
    await request(server())
      .post("/v1/signer/initialise")
      .set("Authorization", harness.admin)
      .send({ passphrase: "a long recovery passphrase" })
      .expect(409);
    expect(
      await harness.prisma.auditEvent.count({
        where: { kind: "signer.initialised" },
      }),
    ).toBe(1);
  });
});
