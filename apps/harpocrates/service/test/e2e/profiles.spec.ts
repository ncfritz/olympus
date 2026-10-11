import { X509Certificate } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  startHarness,
  type Harness,
} from "../support/e2e";
import { bearer } from "../support/tokens";

type Profile = {
  id: string;
  version: number;
  description: string;
  active: boolean;
  validityDays: number;
  renewAtDays: number;
  keyUsages: string[];
};

/** A profile's settings, as a new one is made. */
const settings = {
  issuerPurpose: "Service",
  keyAlgorithm: "P-256",
  validityDays: 120,
  renewAtDays: 80,
  maxKeyAgeDays: 365,
  allowCsr: true,
  allowGenerated: true,
  legacyExport: false,
  requireSan: false,
  escrow: true,
  escrowOverridable: false,
  extensions: "standard",
  keyUsages: ["digital_signature"],
  extendedKeyUsages: [OID.clientAuth],
  nameTypes: ["dns"],
};

const days = (pem: string) => {
  const parsed = new X509Certificate(pem);
  return Math.round(
    (Date.parse(parsed.validTo) - Date.parse(parsed.validFrom)) / 86_400_000,
  );
};

/**
 * Profiles as versioned presets (ADR 0034, phase 10 step 2): made, edited
 * into versions, copied, deactivated and reactivated; certificates renew
 * under their own version until moved.
 */
describe.skipIf(!E2E_DATABASE_URL)("profiles", () => {
  let harness: Harness;
  const server = () => harness.app.getHttpServer();
  const profile = (response: request.Response) =>
    (response.body as { profile: Profile }).profile;

  const create = (body: object, token = harness.admin) =>
    request(server())
      .post("/v1/profiles")
      .set("Authorization", token)
      .send({ profile: body });
  const edit = (id: string, body: object, token = harness.admin) =>
    request(server())
      .put(`/v1/profile/${id}`)
      .set("Authorization", token)
      .send({ profile: body });
  const issue = async (profileId: string, commonName: string) =>
    (
      (
        await request(server())
          .post("/v1/certificates")
          .set("Authorization", harness.operator)
          .send({ profileId, subject: { commonName } })
      ).body as { certificate: { id: string; certificate: string } }
    ).certificate;
  const renew = async (certificateId: string) =>
    (
      (
        await request(server())
          .post(`/v1/certificate/${certificateId}/renew`)
          .set("Authorization", harness.operator)
          .send({})
          .expect(201)
      ).body as { certificate: { id: string; certificate: string } }
    ).certificate;

  beforeAll(async () => {
    harness = await startHarness();
    await buildHierarchy(harness, [
      {
        purpose: "Service",
        extendedKeyUsages: [OID.clientAuth, OID.serverAuth],
      },
    ]);
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("makes a profile at v1, an admin's after a recent sign-in", async () => {
    const response = await create({
      id: "web-client",
      description: "Web clients",
      ...settings,
    }).expect(201);
    expect(response.headers.location).toMatch(/\/profile\/web-client$/);
    expect(profile(response)).toMatchObject({
      id: "web-client",
      version: 1,
      active: true,
      validityDays: 120,
    });
    await create(
      { id: "by-operator", description: "x", ...settings },
      harness.operator,
    ).expect(403);
    await create(
      { id: "stale-admin", description: "x", ...settings },
      await bearer(["pki-admin"], 3600),
    ).expect(403);
    await create({
      id: "web-client",
      description: "again",
      ...settings,
    }).expect(409);
  });

  it("refuses settings that do not hold together", async () => {
    const refused = await create({
      id: "broken",
      description: "x",
      ...settings,
      renewAtDays: 120,
      allowCsr: false,
      allowGenerated: false,
    }).expect(422);
    expect(refused.body.message).toMatch(/renews at 120 days/);
    expect(refused.body.message).toMatch(/neither a CSR nor a generated key/);
    await create({
      id: "wrong-issuer",
      description: "x",
      ...settings,
      issuerPurpose: "TLS",
      issuerId: "service-issuing-1-g1",
    }).expect(422);
    await create({
      id: "Bad Name",
      description: "x",
      ...settings,
    }).expect(400);
  });

  it("edits into versions: a setting makes the next, the description none", async () => {
    expect(
      profile(
        await edit("web-client", { description: "Web clients, mTLS" }).expect(
          200,
        ),
      ),
    ).toMatchObject({ version: 1, description: "Web clients, mTLS" });
    expect(
      profile(await edit("web-client", { validityDays: 120 }).expect(200))
        .version,
    ).toBe(1);
    expect(
      profile(
        await edit("web-client", {
          validityDays: 60,
          renewAtDays: 40,
          keyUsages: ["digital_signature", "key_agreement"],
        }).expect(200),
      ),
    ).toMatchObject({
      version: 2,
      validityDays: 60,
      keyUsages: ["digital_signature", "key_agreement"],
    });
    await edit("web-client", { renewAtDays: 90 }).expect(422);
    await edit("web-client", { validityDays: 30 }, harness.operator).expect(
      403,
    );
    const versions = (
      await request(server())
        .get("/v1/profile/web-client/versions")
        .set("Authorization", harness.operator)
        .expect(200)
    ).body as { versions: { version: number; validityDays: number }[] };
    expect(versions.versions.map((v) => [v.version, v.validityDays])).toEqual([
      [2, 60],
      [1, 120],
    ]);
  });

  it("renews under the version issued under, until moved to another", async () => {
    const before = await issue("web-client", "versioned-client");
    expect(days(before.certificate)).toBe(60);
    await edit("web-client", { validityDays: 90, renewAtDays: 60 }).expect(200);
    expect(days((await renew(before.id)).certificate)).toBe(60);
    const renewed = await harness.prisma.certificate.findFirstOrThrow({
      where: { renewsId: before.id },
    });

    const moved = await request(server())
      .post("/v1/profile/web-client/move")
      .set("Authorization", harness.admin)
      .send({ certificateIds: [renewed.id], version: 3 })
      .expect(200);
    expect(moved.body).toEqual({ moved: 1 });
    expect(days((await renew(renewed.id)).certificate)).toBe(90);

    const elsewhere = await issue("service", "not-web-client");
    await request(server())
      .post("/v1/profile/web-client/move")
      .set("Authorization", harness.admin)
      .send({ certificateIds: [elsewhere.id], version: 3 })
      .expect(422);
    await request(server())
      .post("/v1/profile/web-client/move")
      .set("Authorization", harness.admin)
      .send({ certificateIds: [renewed.id], version: 9 })
      .expect(404);
  });

  it("deactivates: nothing new chooses it, what it issued renews", async () => {
    const issued = await issue("web-client", "before-deactivation");
    expect(
      profile(
        await request(server())
          .post("/v1/profile/web-client/deactivate")
          .set("Authorization", harness.admin)
          .expect(200),
      ).active,
    ).toBe(false);
    const refused = await request(server())
      .post("/v1/certificates")
      .set("Authorization", harness.operator)
      .send({ profileId: "web-client", subject: { commonName: "after" } })
      .expect(422);
    expect(refused.body.message).toMatch(/deactivated/);
    await renew(issued.id);
    expect(
      profile(
        await request(server())
          .post("/v1/profile/web-client/reactivate")
          .set("Authorization", harness.admin)
          .expect(200),
      ).active,
    ).toBe(true);
    await request(server())
      .post("/v1/certificates")
      .set("Authorization", harness.operator)
      .send({ profileId: "web-client", subject: { commonName: "after" } })
      .expect(201);
  });

  it("copies a version into a new profile's v1", async () => {
    const copied = await request(server())
      .post("/v1/profile/web-client/copy")
      .set("Authorization", harness.admin)
      .send({ id: "web-client-short", version: 2 })
      .expect(201);
    expect(copied.headers.location).toMatch(/\/profile\/web-client-short$/);
    expect(profile(copied)).toMatchObject({
      id: "web-client-short",
      version: 1,
      description: "Web clients, mTLS",
      validityDays: 60,
      keyUsages: ["digital_signature", "key_agreement"],
    });
    await request(server())
      .post("/v1/profile/web-client/copy")
      .set("Authorization", harness.admin)
      .send({ id: "service" })
      .expect(409);
    await request(server())
      .post("/v1/profile/web-client/copy")
      .set("Authorization", harness.admin)
      .send({ id: "web-client-none", version: 9 })
      .expect(404);
  });

  it("pins an issuer as a new version", async () => {
    expect(
      profile(
        await edit("service", { issuerId: "service-issuing-1-g1" }).expect(200),
      ),
    ).toMatchObject({ version: 2, issuerId: "service-issuing-1-g1" });
  });

  it("audits every change", async () => {
    const kinds = (
      await harness.prisma.auditEvent.findMany({
        where: { subjectType: "profile" },
        select: { kind: true },
      })
    ).map((e) => e.kind);
    expect(new Set(kinds)).toEqual(
      new Set([
        "profile.created",
        "profile.updated",
        "profile.deactivated",
        "profile.reactivated",
        "profile.enrollments-moved",
      ]),
    );
  });
});
