import { spawnSync } from "child_process";
import { generateKeyPairSync } from "crypto";
import * as fs from "fs";
import * as http from "http";
import type { AddressInfo } from "net";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { E2E_DATABASE_URL, startHarness, type Harness } from "../support/e2e";
import { accessToken } from "../support/tokens";

/** Who each test token's subject is, as the Olympus API answers /v1/auth/me. */
const EMAILS: Record<string, string> = {
  "user-1": "neil@ncfritz.net",
  "user-2": "guest@ncfritz.net",
  "user-3": "nobody@ncfritz.net",
};

/** A stand-in for the Olympus API: only who is signed in. */
const startOlympus = async () => {
  const server = http.createServer((req, res) => {
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString() || "{}",
    ) as { sub?: string };
    const email = EMAILS[payload.sub ?? ""];
    res.writeHead(email && req.url === "/v1/auth/me" ? 200 : 404, {
      "content-type": "application/json",
    });
    res.end(JSON.stringify(email ? { user: { email } } : {}));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
};

/** A new Ed25519 public key, OpenSSH format. */
const sshKey = (comment = "test"): string => {
  const raw = generateKeyPairSync("ed25519")
    .publicKey.export({ type: "spki", format: "der" })
    .subarray(-32);
  const field = (data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, data]);
  };
  const blob = Buffer.concat([field(Buffer.from("ssh-ed25519")), field(raw)]);
  return `ssh-ed25519 ${blob.toString("base64")} ${comment}`;
};

const hasKeygen = spawnSync("ssh-keygen", ["-?"]).error === undefined;

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
  typeKrlUrl: string;
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
  let olympus: Awaited<ReturnType<typeof startOlympus>>;
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
    olympus = await startOlympus();
    harness = await startHarness({
      env: {
        OLYMPUS_API_URL: olympus.url,
        OLYMPUS_SIGN_IN_URL: "https://olympus.test/api",
        AUTH_BASE_URL: "https://control.test/harpocrates/ca/api",
        WEB_APP_URL: "https://control.test/harpocrates/ca",
      },
    });
  });

  afterAll(async () => {
    await harness?.close();
    await olympus?.close();
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
      expect(user.typeKrlUrl).toMatch(/\/krl\/ssh-user\.krl$/);

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

  describe("certificates", () => {
    type Certificate = {
      id: string;
      type: string;
      caId: string;
      principals: string[];
      keyIdentifier: string;
      identity?: string;
      state: string;
      certificate: string;
      fingerprint: string;
      validAfter: string;
      validBefore: string;
      contents: Record<string, unknown>;
    };
    const certificateOf = (response: request.Response) =>
      (response.body as { certificate: Certificate }).certificate;
    let guest: string;
    let nobody: string;
    const issueUser = (body: object, token: string) =>
      request(server())
        .post("/v1/ssh/certificates/user")
        .set("Authorization", token)
        .send(body);
    const issueHost = (body: object, token = harness.admin) =>
      request(server())
        .post("/v1/ssh/certificates/host")
        .set("Authorization", token)
        .send(body);
    const keygen = (certificate: string, ...args: string[]) => {
      const file = path.join(harness.dir, `cert-${Date.now()}-cert.pub`);
      fs.writeFileSync(file, `${certificate}\n`);
      return spawnSync("ssh-keygen", [...args, file], { encoding: "utf8" });
    };

    beforeAll(async () => {
      guest = `Bearer ${await accessToken({ roles: [], sub: "user-2" })}`;
      nobody = `Bearer ${await accessToken({ roles: [], sub: "user-3" })}`;
      await setPrincipals("guest@ncfritz.net", ["guest", "backup"]).expect(200);
      await setPrincipals("neil@ncfritz.net", ["ncfritz"]).expect(200);
    });

    it("issues a user certificate for one's own key and mapped principals, with no PKI role", async () => {
      const issued = await issueUser({ publicKey: sshKey() }, guest).expect(
        201,
      );
      expect(issued.headers.location).toMatch(
        /\/ssh\/certificate\/[0-9a-f-]+$/,
      );
      const certificate = certificateOf(issued);
      expect(certificate).toMatchObject({
        type: "user",
        caId: "ssh-user-1-g2",
        identity: "guest@ncfritz.net",
        principals: ["guest", "backup"],
        state: "valid",
      });
      expect(certificate.keyIdentifier).toMatch(
        /^guest@ncfritz\.net:[0-9a-f]{16}$/,
      );
      expect(certificate.fingerprint).toMatch(/^SHA256:/);
      expect(certificate.contents).toMatchObject({
        type: "user",
        keyId: certificate.keyIdentifier,
        principals: ["guest", "backup"],
        extensions: ["permit-port-forwarding", "permit-pty"],
      });
      // The certificate holds whole seconds.
      expect(
        Math.floor(Date.parse(certificate.validBefore) / 1000) * 1000,
      ).toBe(Date.parse(certificate.contents.validBefore as string));
      const hours =
        (Date.parse(certificate.validBefore) -
          Date.parse(certificate.validAfter)) /
        3_600_000;
      expect(Math.round(hours * 12) / 12).toBeCloseTo(16 + 5 / 60, 1);
      if (hasKeygen) {
        const listing = keygen(certificate.certificate, "-L", "-f").stdout;
        expect(listing).toMatch(/user certificate/);
        expect(listing).toMatch(/permit-pty/);
        expect(listing).toMatch(/guest\n\s+backup/);
      }
      const mine = await request(server())
        .get("/v1/ssh/mine")
        .set("Authorization", guest)
        .expect(200);
      expect(mine.body).toMatchObject({
        identity: "guest@ncfritz.net",
        principals: ["guest", "backup"],
      });
      expect(mine.body.certificates).toHaveLength(1);
      expect(mine.body.hostTrustLines).toEqual([
        expect.stringMatching(
          /^@cert-authority \*\.internal\.ncfritz\.net ssh-ed25519 \S+ .* SSH Host CA 1 - G1$/,
        ),
      ]);
    });

    it("never more than one's mapping, nor for someone else unless an admin", async () => {
      await issueUser({ publicKey: sshKey() }, nobody).expect(403);
      await issueUser(
        { publicKey: sshKey(), principals: ["root"] },
        guest,
      ).expect(403);
      await issueUser(
        { publicKey: sshKey(), identity: "neil@ncfritz.net" },
        guest,
      ).expect(403);
      const forGuest = certificateOf(
        await issueUser(
          {
            publicKey: sshKey(),
            identity: "guest@ncfritz.net",
            principals: ["backup"],
          },
          harness.admin,
        ).expect(201),
      );
      expect(forGuest).toMatchObject({
        identity: "guest@ncfritz.net",
        principals: ["backup"],
      });
      await issueUser({ publicKey: "ssh-dss AAAA" }, guest).expect(400);
    });

    it("keeps a key to one use", async () => {
      const key = sshKey();
      await issueUser({ publicKey: key }, guest).expect(201);
      // The same key, profile and principals: reissued.
      await issueUser({ publicKey: key }, guest).expect(201);
      await issueUser({ publicKey: key, principals: ["guest"] }, guest).expect(
        409,
      );
      await issueHost({
        publicKey: key,
        principals: ["mini.internal.ncfritz.net"],
      }).expect(409);
    });

    it("issues a host certificate, an admin's", async () => {
      const body = {
        publicKey: sshKey("root@mini"),
        principals: ["Mini.internal.ncfritz.net", "mini"],
      };
      await issueHost(body, harness.operator).expect(403);
      const host = certificateOf(await issueHost(body).expect(201));
      expect(host).toMatchObject({
        type: "host",
        caId: "ssh-host-1-g1",
        principals: ["mini.internal.ncfritz.net", "mini"],
      });
      expect(host.identity).toBeUndefined();
      expect(host.keyIdentifier).toMatch(/^mini\.internal\.ncfritz\.net:/);
      if (hasKeygen) {
        const listing = keygen(host.certificate, "-L", "-f").stdout;
        expect(listing).toMatch(/host certificate/);
        expect(listing).not.toMatch(/permit-pty/);
      }
    });

    it("revokes, and the CA's KRL says so at once", async () => {
      const issued = certificateOf(
        await issueUser({ publicKey: sshKey() }, guest).expect(201),
      );
      const revoked = await request(server())
        .post(`/v1/ssh/certificate/${issued.id}/revoke`)
        .set("Authorization", harness.operator)
        .send({ reason: "superseded" })
        .expect(200);
      expect(certificateOf(revoked).state).toBe("revoked");
      await request(server())
        .post(`/v1/ssh/certificate/${issued.id}/revoke`)
        .set("Authorization", harness.operator)
        .send({})
        .expect(409);
      const krl = path.join(harness.published, "krl", "ssh-user-1-g2.krl");
      expect(fs.existsSync(krl)).toBe(true);
      if (hasKeygen) {
        expect(keygen(issued.certificate, "-Q", "-f", krl).status).not.toBe(0);
        const other = certificateOf(
          await issueUser({ publicKey: sshKey() }, guest).expect(201),
        );
        expect(keygen(other.certificate, "-Q", "-f", krl).status).toBe(0);
        // Every user CA's revocations together: the one file a host's
        // RevokedKeys names.
        const all = path.join(harness.published, "krl", "ssh-user.krl");
        expect(keygen(issued.certificate, "-Q", "-f", all).status).not.toBe(0);
        expect(keygen(other.certificate, "-Q", "-f", all).status).toBe(0);
      }
      const current = await request(server())
        .get("/v1/ssh/certificates?type=user&current=true")
        .set("Authorization", harness.operator)
        .expect(200);
      expect(
        (current.body.certificates as Certificate[]).every(
          (c) => c.state === "valid" && c.type === "user",
        ),
      ).toBe(true);
      expect(
        await harness.prisma.auditEvent.count({
          where: { kind: "ssh-certificate.revoked" },
        }),
      ).toBe(1);
    });

    it("previews an SSH version, signed by no CA", async () => {
      const preview = await request(server())
        .post("/v1/profiles/preview")
        .set("Authorization", harness.admin)
        .send({ kind: "ssh", profile: sshSettings })
        .expect(200);
      expect(preview.body.preview.problems).toEqual([]);
      expect(preview.body.preview.refusals).toEqual([]);
      expect(preview.body.preview.issuerId).toBe("ssh-user-1-g2");
      const certificate = preview.body.preview.certificate as string;
      expect(certificate).toMatch(/^ssh-ed25519-cert-v01@openssh\.com /);
      expect(preview.body.preview.sshCertificate).toMatchObject({
        type: "user",
        keyType: "ssh-ed25519",
        principals: ["preview"],
        criticalOptions: [{ name: "source-address", value: "192.168.15.0/24" }],
        extensions: ["permit-pty"],
      });
      if (hasKeygen) {
        const listing = keygen(certificate, "-L", "-f").stdout;
        expect(listing).toMatch(/source-address 192\.168\.15\.0\/24/);
        const ca = (
          await request(server())
            .get("/v1/ssh/ca/ssh-user-1-g2")
            .set("Authorization", harness.admin)
        ).body.ca as SshCa;
        expect(listing).not.toContain(ca.publicKey.split(" ")[1].slice(0, 20));
      }
    });
  });
});
