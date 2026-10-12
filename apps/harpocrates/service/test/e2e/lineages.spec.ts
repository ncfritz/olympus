import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LineageService } from "../../src/certificates/services/LineageService";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  makeCsr,
  startHarness,
  type Harness,
} from "../support/e2e";

const DAY = 24 * 60 * 60 * 1000;

type Lineage = {
  lineageId: string;
  name: string;
  names: string[];
  issuerId: string;
  profileId?: string;
  state: string;
  health?: string;
  renewer: string;
  renewal: string;
  renewalDueAt: string;
  deployTargets: string[];
  versions: {
    certificateId: string;
    serial: string;
    state: string;
    renews: boolean;
    revokedAt?: string;
    revocationReason?: string;
  }[];
};

/**
 * The certificates list's lineages (GET /v1/certificate-lineages): each
 * subject's certificates together, newest first, linked by renewal or
 * issued again for the same subject; how the newest is renewed.
 */
describe.skipIf(!E2E_DATABASE_URL)("certificate lineages", () => {
  let harness: Harness;
  const server = () => harness.app.getHttpServer();

  const issue = async (commonName: string, csr = true) => {
    const body = csr
      ? {
          profileId: "internal-tls",
          subject: { commonName },
          names: { dns: [commonName] },
          csr: (await makeCsr(commonName, [commonName])).csr,
        }
      : {
          profileId: "internal-tls",
          subject: { commonName },
          names: { dns: [commonName] },
        };
    return (
      (
        await request(server())
          .post("/v1/certificates")
          .set("Authorization", harness.operator)
          .send(body)
          .expect(201)
      ).body as { certificate: { id: string; serial: string } }
    ).certificate;
  };

  const lineages = async () =>
    (
      (
        await request(server())
          .get("/v1/certificate-lineages")
          .set("Authorization", harness.operator)
          .expect(200)
      ).body as { asOf: string; lineages: Lineage[] }
    ).lineages;

  const lineageOf = (all: Lineage[], certificateId: string) =>
    all.find((l) => l.versions.some((v) => v.certificateId === certificateId));

  beforeAll(async () => {
    harness = await startHarness();
    await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
    ]);
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("lists one certificate as a lineage of one", async () => {
    const certificate = await issue("lin-a.internal.ncfritz.net");
    const lineage = lineageOf(await lineages(), certificate.id);
    expect(lineage).toMatchObject({
      lineageId: certificate.id,
      name: "lin-a.internal.ncfritz.net",
      names: ["lin-a.internal.ncfritz.net"],
      issuerId: "tls-issuing-1-g1",
      profileId: "internal-tls",
      state: "valid",
      health: "healthy",
      renewer: "person",
      renewal: "manual",
      deployTargets: [],
    });
    expect(lineage?.versions).toEqual([
      expect.objectContaining({
        certificateId: certificate.id,
        serial: certificate.serial,
        state: "valid",
        renews: false,
      }),
    ]);
  });

  it("joins a certificate ordered again for the same subject, newest first", async () => {
    const first = await issue("lin-b.internal.ncfritz.net");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = await issue("lin-b.internal.ncfritz.net");
    const lineage = lineageOf(await lineages(), first.id);
    expect(lineage?.lineageId).toBe(first.id);
    expect(lineage?.versions.map((v) => [v.certificateId, v.renews])).toEqual([
      [second.id, true],
      [first.id, false],
    ]);
    // One lineage, not two.
    expect(
      (await lineages()).filter((l) => l.name === "lin-b.internal.ncfritz.net"),
    ).toHaveLength(1);
  });

  it("joins a renewal to what it renews", async () => {
    const first = await issue("lin-c.internal.ncfritz.net", false);
    const renewed = (
      (
        await request(server())
          .post(`/v1/certificate/${first.id}/renew`)
          .set("Authorization", harness.operator)
          .send({})
          .expect(201)
      ).body as { certificate: { id: string } }
    ).certificate;
    const lineage = lineageOf(await lineages(), renewed.id);
    expect(lineage?.versions.map((v) => v.certificateId)).toEqual([
      renewed.id,
      first.id,
    ]);
  });

  it("names a revoked newest version, without a health", async () => {
    const certificate = await issue("lin-d.internal.ncfritz.net");
    await request(server())
      .post(`/v1/certificate/${certificate.id}/revoke`)
      .set("Authorization", harness.operator)
      .send({ reason: "superseded" })
      .expect(200);
    const lineage = lineageOf(await lineages(), certificate.id);
    expect(lineage?.state).toBe("revoked");
    expect(lineage?.health).toBeUndefined();
    expect(lineage?.versions[0]).toMatchObject({
      state: "revoked",
      revocationReason: "superseded",
      revokedAt: expect.any(String),
    });
  });

  it("reads health as the dashboard does, and lists the ended for a year", async () => {
    const certificate = await issue("lin-e.internal.ncfritz.net");
    const read = (days: number) =>
      harness.app.get(LineageService).list(new Date(Date.now() + days * DAY));
    const due = (await read(65)).find(
      (l) => l.versions[0].certificateId === certificate.id,
    );
    expect(due?.health).toBe("needs-person");
    const ended = (await read(95)).find(
      (l) => l.versions[0].certificateId === certificate.id,
    );
    expect(ended).toMatchObject({ state: "expired", health: "expired" });
    const gone = (await read(90 + 366)).find(
      (l) => l.versions[0].certificateId === certificate.id,
    );
    expect(gone).toBeUndefined();
  });

  it("needs a PKI role", async () => {
    await request(server()).get("/v1/certificate-lineages").expect(401);
  });
});
