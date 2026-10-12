import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { E2E_DATABASE_URL, startHarness, type Harness } from "../support/e2e";

type SshCa = {
  id: string;
  name: string;
  type: string;
  generation: number;
  status: string;
  publicKey: string;
  trustLine: string;
  maxValidityHours: number;
  krlUrl: string;
};

/** An SSH profile's settings, as a new one is made. */
const sshSettings = {
  issuerPurpose: "SSH User",
  keyAlgorithm: "Ed25519",
  validityDays: 1,
  renewAtDays: 1,
  maxKeyAgeDays: 365,
  allowCsr: true,
  allowGenerated: false,
  legacyExport: false,
  minNames: 0,
  escrow: false,
  escrowOverridable: false,
  extensions: "standard",
  keyUsages: [],
  extendedKeyUsages: [],
  names: [],
  namePolicy: [],
  subjectAttributes: [],
  keyAlgorithms: [],
  csrSignatureHashes: [],
  signatureHash: "sha256",
  rsaPadding: "pkcs1v15",
  subjectKeyIdentifier: "sha1",
  authorityKeyIdentifier: "key_id",
  basicConstraints: "critical",
  includeCrlDistribution: true,
  includeCaIssuers: true,
  includeIssuerAltName: false,
  policies: [],
  customExtensions: [],
  ssh: {
    certificateType: "user",
    validityHours: 8,
    renewAtHours: 6,
    sourceAddresses: ["192.168.15.0/24"],
    extensions: ["permit-pty"],
  },
};

/**
 * SSH CAs, who may log in as whom, and SSH profiles (ADR 0035, phase 9
 * step 2).
 */
describe.skipIf(!E2E_DATABASE_URL)("ssh", () => {
  let harness: Harness;
  const server = () => harness.app.getHttpServer();
  const createCa = (body: object, token = harness.admin) =>
    request(server())
      .post("/v1/ssh/cas")
      .set("Authorization", token)
      .send(body);
  const ca = (response: request.Response) =>
    (response.body as { ca: SshCa }).ca;
  const setPrincipals = (
    identity: string,
    principals: string[],
    token = harness.admin,
  ) =>
    request(server())
      .put(`/v1/ssh/principals/${encodeURIComponent(identity)}`)
      .set("Authorization", token)
      .send({ principals });
  const createProfile = (body: object) =>
    request(server())
      .post("/v1/profiles")
      .set("Authorization", harness.admin)
      .send({ profile: body });

  beforeAll(async () => {
    harness = await startHarness();
  });

  afterAll(async () => {
    await harness?.close();
  });

  describe("CAs", () => {
    it("creates the user and host CAs, an admin's after a recent sign-in", async () => {
      await createCa({ type: "user" }, harness.operator).expect(403);
      const created = await createCa({ type: "user" }).expect(201);
      expect(created.headers.location).toMatch(/\/ssh\/ca\/ssh-user-1-g1$/);
      const user = ca(created);
      expect(user).toMatchObject({
        id: "ssh-user-1-g1",
        type: "user",
        generation: 1,
        status: "active",
        maxValidityHours: 168,
      });
      expect(user.name).toMatch(/ SSH User CA 1 - G1$/);
      expect(user.publicKey).toMatch(/^ssh-ed25519 \S+$/);
      expect(user.trustLine).toBe(`${user.publicKey} ${user.name}`);
      expect(user.krlUrl).toMatch(/\/krl\/ssh-user-1-g1\.krl$/);

      const host = ca(
        await createCa({ type: "host", maxValidityHours: 2400 }).expect(201),
      );
      expect(host).toMatchObject({
        id: "ssh-host-1-g1",
        maxValidityHours: 2400,
      });
      expect(host.trustLine).toBe(
        `@cert-authority *.internal.ncfritz.net ${host.publicKey} ${host.name}`,
      );
      expect(host.publicKey).not.toBe(user.publicKey);
    });

    it("rotates by the next generation, and retires the old", async () => {
      const next = ca(await createCa({ type: "user" }).expect(201));
      expect(next).toMatchObject({ id: "ssh-user-1-g2", generation: 2 });
      const listed = (
        (
          await request(server())
            .get("/v1/ssh/cas")
            .set("Authorization", harness.operator)
            .expect(200)
        ).body as { cas: SshCa[] }
      ).cas.map((c) => c.id);
      expect(listed).toEqual([
        "ssh-user-1-g2",
        "ssh-user-1-g1",
        "ssh-host-1-g1",
      ]);
      await request(server())
        .post("/v1/ssh/ca/ssh-user-1-g1/retire")
        .set("Authorization", harness.operator)
        .expect(403);
      const retired = ca(
        await request(server())
          .post("/v1/ssh/ca/ssh-user-1-g1/retire")
          .set("Authorization", harness.admin)
          .expect(200),
      );
      expect(retired.status).toBe("retired");
      const kinds = (
        await harness.prisma.auditEvent.findMany({
          where: { subjectType: "ssh-ca" },
        })
      ).map((e) => e.kind);
      expect(kinds.sort()).toEqual([
        "ssh-ca.created",
        "ssh-ca.created",
        "ssh-ca.created",
        "ssh-ca.retired",
      ]);
    });
  });

  describe("principals", () => {
    it("maps an identity to its principals, an admin's", async () => {
      await setPrincipals(
        "neil@ncfritz.net",
        ["ncfritz"],
        harness.operator,
      ).expect(403);
      const set = await setPrincipals("Neil@ncfritz.net", [
        "ncfritz",
        "admin",
      ]).expect(200);
      expect(set.body.mapping).toMatchObject({
        identity: "neil@ncfritz.net",
        principals: ["ncfritz", "admin"],
      });
      await setPrincipals("neil@ncfritz.net", ["admin", "backup"]).expect(200);
      const listed = await request(server())
        .get("/v1/ssh/principals")
        .set("Authorization", harness.admin)
        .expect(200);
      expect(listed.body.mappings).toEqual([
        expect.objectContaining({
          identity: "neil@ncfritz.net",
          principals: ["admin", "backup"],
        }),
      ]);
      await setPrincipals("neil@ncfritz.net", ["no spaces"]).expect(400);
      await setPrincipals("not-an-email", ["x"]).expect(400);
      const removed = await setPrincipals("neil@ncfritz.net", []).expect(200);
      expect(removed.body.mapping).toBeUndefined();
      expect(
        await harness.prisma.auditEvent.count({
          where: { kind: "ssh-principals.set" },
        }),
      ).toBe(3);
    });
  });

  describe("profiles", () => {
    it("seeds ssh-user and ssh-host as SSH profiles", async () => {
      const profiles = (
        await request(server())
          .get("/v1/profiles")
          .set("Authorization", harness.operator)
          .expect(200)
      ).body.profiles as {
        id: string;
        kind: string;
        ssh?: object;
      }[];
      expect(profiles.find((p) => p.id === "ssh-user")).toMatchObject({
        kind: "ssh",
        version: 1,
        ssh: {
          certificateType: "user",
          validityHours: 16,
          renewAtHours: 12,
          sourceAddresses: [],
          extensions: ["permit-port-forwarding", "permit-pty"],
        },
      });
      expect(profiles.find((p) => p.id === "ssh-host")).toMatchObject({
        kind: "ssh",
        ssh: { certificateType: "host", validityHours: 2160 },
      });
      expect(profiles.find((p) => p.id === "internal-tls")).toMatchObject({
        kind: "x509",
      });
    });

    it("makes, versions and copies an SSH profile, which keeps its kind", async () => {
      const made = await createProfile({
        id: "ssh-ops",
        kind: "ssh",
        description: "Operators, from the LAN",
        ...sshSettings,
      }).expect(201);
      expect(made.body.profile).toMatchObject({ kind: "ssh", version: 1 });
      const edited = await request(server())
        .put("/v1/profile/ssh-ops")
        .set("Authorization", harness.admin)
        .send({
          profile: { ssh: { ...sshSettings.ssh, validityHours: 12 } },
        })
        .expect(200);
      expect(edited.body.profile).toMatchObject({
        version: 2,
        ssh: { validityHours: 12 },
      });
      const copied = await request(server())
        .post("/v1/profile/ssh-ops/copy")
        .set("Authorization", harness.admin)
        .send({ id: "ssh-ops-copy", version: 1 })
        .expect(201);
      expect(copied.body.profile).toMatchObject({
        kind: "ssh",
        ssh: { validityHours: 8 },
      });
    });

    it("refuses an SSH version whose settings do not hold together", async () => {
      const refused = await createProfile({
        id: "ssh-unruly",
        kind: "ssh",
        description: "x",
        ...sshSettings,
        keyAlgorithms: ["RSA-2048", "DSA-2048"],
        ssh: {
          certificateType: "host",
          sshCaId: "ssh-user-1-g2",
          validityHours: 200,
          renewAtHours: 300,
          sourceAddresses: ["not-an-address"],
          extensions: ["permit-pty"],
        },
      }).expect(422);
      for (const problem of [
        /renews at 300 hours, not before its 200-hour validity/,
        /a host certificate carries no critical options or extensions/,
        /not-an-address is not an address or network/,
        /OpenSSH takes no RSA-2048, DSA-2048 key/,
        /its CA ssh-user-1-g2 signs user certificates, not host ones/,
        /its CA ssh-user-1-g2 signs for at most 168 hours/,
      ]) {
        expect(refused.body.message).toMatch(problem);
      }
      const missing = await createProfile({
        id: "ssh-bare",
        kind: "ssh",
        description: "x",
        ...sshSettings,
        ssh: undefined,
      }).expect(422);
      expect(missing.body.message).toMatch(/needs its SSH settings/);
      const mixed = await createProfile({
        id: "x509-with-ssh",
        description: "x",
        ...sshSettings,
        issuerPurpose: "Service",
        keyAlgorithm: "P-256",
        allowGenerated: true,
      }).expect(422);
      expect(mixed.body.message).toMatch(/has no SSH settings/);
    });

    it("issues no X.509 certificate under an SSH profile", async () => {
      const refused = await request(server())
        .post("/v1/certificates")
        .set("Authorization", harness.operator)
        .send({ profileId: "ssh-user", subject: { commonName: "x" } })
        .expect(422);
      expect(refused.body.message).toMatch(/issues SSH certificates/);
    });
  });
});
