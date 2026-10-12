import { createPrivateKey, X509Certificate } from "crypto";
import * as fs from "fs";
import * as https from "https";
import type { AddressInfo } from "net";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DeployScheduler } from "../../src/deploy/services/DeployScheduler";
import { OID } from "../../src/pki/x509";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  type Hierarchy,
  makeCsr,
  startHarness,
  type Harness,
} from "../support/e2e";
import { selfSignedTls } from "../support/tls";
import { bearer } from "../support/tokens";

type Deployment = {
  id: string;
  certificateId: string;
  serial: string;
  status: "pending" | "deployed" | "superseded";
  principal: string;
  attempts: number;
  lastError?: string;
};

type Observation = {
  endpoint: string;
  result: "current" | "previous" | "other" | "unreachable";
  expectedCertificateId: string;
  servedCertificateId?: string;
  servedSerial?: string;
  error?: string;
  checks: number;
};

type Target = {
  id: string;
  name: string;
  endpoint: string;
  lastObservation?: Observation;
  observations: Observation[];
  kind: string;
  certificateId: string;
  renewsAt: string;
  notAfter: string;
  lastDeployment?: Deployment;
  deployments: Deployment[];
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Deploy targets (ADR 0020, Renewal and delivery): a generated, escrowed
 * certificate written for a web server to read, renewed by Harpocrates
 * when due, and every new certificate deployed, retried and audited.
 */
describe.skipIf(!E2E_DATABASE_URL)("deploy targets", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  let deployDir: string;
  const server = () => harness.app.getHttpServer();

  /** An internal-tls certificate for `host`, its key generated. */
  const hostCertificate = async (host: string, body = {}) =>
    (
      (
        await request(server())
          .post("/v1/certificates")
          .set("Authorization", harness.operator)
          .send({
            profileId: "internal-tls",
            subject: { commonName: host },
            names: { dns: [host] },
            ...body,
          })
          .expect(201)
      ).body as { certificate: { id: string; serial: string } }
    ).certificate;

  const createTarget = (name: string, certificateId: string) =>
    request(server())
      .post("/v1/deploy-targets")
      .set("Authorization", harness.admin)
      .send({ name, certificateId });

  const describeTarget = async (id: string) =>
    (
      (
        await request(server())
          .get(`/v1/deploy-target/${id}`)
          .set("Authorization", harness.operator)
          .expect(200)
      ).body as { deployTarget: Target }
    ).deployTarget;

  /** What the target's directory holds. */
  const installed = (name: string) => {
    const dir = path.join(deployDir, name);
    const fullChain = fs.readFileSync(path.join(dir, "fullchain.pem"), "utf8");
    const certificates = fullChain.match(
      /-----BEGIN CERTIFICATE-----[^-]+-----END CERTIFICATE-----\n/g,
    )!;
    return {
      certificate: new X509Certificate(certificates[0]),
      certificates,
      key: createPrivateKey(fs.readFileSync(path.join(dir, "privkey.pem"))),
      keyMode: fs.statSync(path.join(dir, "privkey.pem")).mode & 0o777,
      marker: fs.readFileSync(path.join(dir, "deployed"), "utf8"),
      files: fs.readdirSync(dir).sort(),
    };
  };

  const scheduler = () => harness.app.get(DeployScheduler);

  beforeAll(async () => {
    deployDir = fs.mkdtempSync(path.join("/tmp", "hrp-deploy-"));
    harness = await startHarness({
      env: { DEPLOY_DIR: deployDir, ENDPOINT_CHECK_SECONDS: "3600" },
    });
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
    fs.rmSync(deployDir, { recursive: true, force: true });
  });

  describe("a new target", () => {
    let certificate: { id: string; serial: string };
    let target: Target;

    beforeAll(async () => {
      certificate = await hostCertificate("nas.internal.ncfritz.net");
      const created = await createTarget(
        "nas.internal.ncfritz.net",
        certificate.id,
      ).expect(201);
      target = (created.body as { deployTarget: Target }).deployTarget;
      expect(created.headers.location).toMatch(
        new RegExp(`/v1/deploy-target/${target.id}$`),
      );
    });

    it("is deployed at once: the chain without the root, and the key, for nginx", () => {
      expect(target).toMatchObject({
        name: "nas.internal.ncfritz.net",
        endpoint: "nas.internal.ncfritz.net:443",
        kind: "host_path",
        certificateId: certificate.id,
      });
      expect(target.deployments).toEqual([
        expect.objectContaining({
          certificateId: certificate.id,
          serial: certificate.serial,
          status: "deployed",
          attempts: 1,
          principal: "user:user-1",
        }),
      ]);
      const files = installed("nas.internal.ncfritz.net");
      expect(files.files).toEqual([
        "cert.pem",
        "deployed",
        "fullchain.pem",
        "privkey.pem",
      ]);
      expect(BigInt(`0x${files.certificate.serialNumber}`)).toBe(
        BigInt(`0x${certificate.serial}`),
      );
      expect(files.certificates).toEqual([
        expect.any(String),
        hierarchy.issuing.TLS.certificate,
        hierarchy.intermediate.certificate,
      ]);
      expect(files.certificate.checkPrivateKey(files.key)).toBe(true);
      expect(files.keyMode).toBe(0o600);
      expect(files.marker).toContain(`certificate=${certificate.id}\n`);
    });

    it("renews when its profile says, as Harpocrates renews it", () => {
      // internal-tls: 90 days, renewed 60 days in.
      const renewsAt = new Date(target.renewsAt).getTime();
      const notAfter = new Date(target.notAfter).getTime();
      expect(Math.round((notAfter - renewsAt) / DAY)).toBe(30);
    });

    it("keeps the key in escrow, and records writing it out", async () => {
      const exports = await harness.prisma.escrowExport.findMany({
        where: { certificateId: certificate.id },
      });
      expect(exports).toEqual([
        expect.objectContaining({
          format: "deploy",
          principal: "system",
          reason: "Deployed to nas.internal.ncfritz.net",
        }),
      ]);
      const key = await harness.prisma.key.findFirstOrThrow({
        where: {
          enrollment: { certificates: { some: { id: certificate.id } } },
        },
      });
      expect(key).toMatchObject({ location: "signer", destroyedAt: null });
      const kinds = (
        await harness.prisma.auditEvent.findMany({
          where: { subjectId: { in: [target.id, key.id] } },
          orderBy: { sequence: "asc" },
        })
      ).map((event) => event.kind);
      expect(kinds).toEqual([
        "key.generated",
        "deploy-target.created",
        "key.exported",
        "deployment.deployed",
      ]);
    });

    it("is listed with its newest deployment", async () => {
      const listed = await request(server())
        .get("/v1/deploy-targets")
        .set("Authorization", harness.operator)
        .expect(200);
      expect(
        (listed.body as { deployTargets: Target[] }).deployTargets,
      ).toEqual([
        expect.objectContaining({
          name: "nas.internal.ncfritz.net",
          lastDeployment: expect.objectContaining({ status: "deployed" }),
        }),
      ]);
    });

    it("takes a name only once", async () => {
      const other = await hostCertificate("other.internal.ncfritz.net");
      const refused = await createTarget(
        "nas.internal.ncfritz.net",
        other.id,
      ).expect(409);
      expect(refused.body.message).toMatch(/exists/);
    });
  });

  describe("refuses", () => {
    it("anyone but an admin who signed in recently", async () => {
      const certificate = await hostCertificate("refused.internal.ncfritz.net");
      await request(server())
        .post("/v1/deploy-targets")
        .set("Authorization", harness.operator)
        .send({ name: "refused", certificateId: certificate.id })
        .expect(403);
      await request(server())
        .post("/v1/deploy-targets")
        .set("Authorization", await bearer(["pki-admin"], 3600))
        .send({ name: "refused", certificateId: certificate.id })
        .expect(403);
    });

    it("a name that is not one directory", async () => {
      const certificate = await hostCertificate("dots.internal.ncfritz.net");
      for (const name of ["../etc", ".hidden", "a/b", "Upper"]) {
        await createTarget(name, certificate.id).expect(400);
      }
    });

    it("a certificate whose key only its subscriber has", async () => {
      const { csr } = await makeCsr("csr.internal.ncfritz.net", [
        "csr.internal.ncfritz.net",
      ]);
      const certificate = await hostCertificate("csr.internal.ncfritz.net", {
        csr,
      });
      const refused = await createTarget("csr", certificate.id).expect(422);
      expect(refused.body.message).toMatch(/subscriber's/);
    });

    it("a certificate whose key was for one export", async () => {
      const profile = { escrowOverridable: true };
      await harness.prisma.profileVersion.updateMany({
        where: { profileId: "internal-tls" },
        data: profile,
      });
      const certificate = await hostCertificate("once.internal.ncfritz.net", {
        escrow: false,
      });
      await harness.prisma.profileVersion.updateMany({
        where: { profileId: "internal-tls" },
        data: { escrowOverridable: false },
      });
      const refused = await createTarget("once", certificate.id).expect(422);
      expect(refused.body.message).toMatch(/one export/);
    });

    it("a revoked certificate", async () => {
      const certificate = await hostCertificate("gone.internal.ncfritz.net");
      await request(server())
        .post(`/v1/certificate/${certificate.id}/revoke`)
        .set("Authorization", harness.operator)
        .send({ reason: "cessationOfOperation" })
        .expect(200);
      const refused = await createTarget("gone", certificate.id).expect(422);
      expect(refused.body.message).toMatch(/revoked/);
    });
  });

  describe("a deployment that fails", () => {
    let target: Target;

    beforeAll(async () => {
      // A file where its directory goes: nothing can be written.
      fs.writeFileSync(path.join(deployDir, "printer"), "in the way");
      const certificate = await hostCertificate("printer.internal.ncfritz.net");
      target = (
        (await createTarget("printer", certificate.id).expect(201)).body as {
          deployTarget: Target;
        }
      ).deployTarget;
    });

    it("is kept, with why, and audited once", async () => {
      expect(target.lastDeployment).toMatchObject({
        status: "pending",
        attempts: 1,
        lastError: expect.stringMatching(/EEXIST|ENOTDIR/),
      });
      const now = Date.now();
      // Not yet due a retry.
      await scheduler().run(new Date(now + 10_000));
      // Due: tried again, still failing.
      await scheduler().run(new Date(now + 60_000));
      const after = await describeTarget(target.id);
      expect(after.lastDeployment).toMatchObject({
        status: "pending",
        attempts: 2,
      });
      const failures = await harness.prisma.auditEvent.count({
        where: { subjectId: target.id, kind: "deployment.failed" },
      });
      expect(failures).toBe(1);
      const metrics = await request(server()).get("/metrics").expect(200);
      expect(metrics.text).toMatch(
        /harpocrates_deployment_pending_seconds\{target="printer"[^}]*\} \d+\n/,
      );
    });

    it("is retried until it succeeds", async () => {
      fs.rmSync(path.join(deployDir, "printer"));
      const run = await scheduler().run(new Date(Date.now() + 20 * 60_000));
      expect(run.deployed).toEqual([
        { target: "printer", certificateId: target.certificateId },
      ]);
      const after = await describeTarget(target.id);
      expect(after.lastDeployment).toMatchObject({
        status: "deployed",
        attempts: 3,
      });
      expect(installed("printer").files).toContain("privkey.pem");
      const metrics = await request(server()).get("/metrics").expect(200);
      expect(metrics.text).toMatch(
        /harpocrates_deployment_pending_seconds\{target="printer"[^}]*\} 0\n/,
      );
    });
  });

  describe("renewal", () => {
    let target: Target;
    let first: { id: string; serial: string };

    beforeAll(async () => {
      first = await hostCertificate("renewed.internal.ncfritz.net");
      target = (
        (await createTarget("renewed", first.id).expect(201)).body as {
          deployTarget: Target;
        }
      ).deployTarget;
    });

    it("is Harpocrates's when due, and the renewal is deployed", async () => {
      const notYet = await scheduler().run(new Date(Date.now() + 59 * DAY));
      expect(notYet.renewed.map((r) => r.target)).not.toContain("renewed");

      const before = installed("renewed");
      const run = await scheduler().run(new Date(Date.now() + 61 * DAY));
      const renewal = run.renewed.find((r) => r.target === "renewed");
      expect(renewal).toBeDefined();
      expect(run.followed).toContainEqual({
        target: "renewed",
        certificateId: renewal!.certificateId,
      });
      expect(run.deployed).toContainEqual({
        target: "renewed",
        certificateId: renewal!.certificateId,
      });

      const after = installed("renewed");
      expect(after.certificate.serialNumber).not.toBe(
        before.certificate.serialNumber,
      );
      // The key is young: renewed, not replaced.
      expect(after.key.export({ format: "pem", type: "pkcs8" })).toEqual(
        before.key.export({ format: "pem", type: "pkcs8" }),
      );
      expect(after.marker).toContain(`certificate=${renewal!.certificateId}`);

      const described = await describeTarget(target.id);
      expect(described.certificateId).toBe(renewal!.certificateId);
      expect(described.deployments.map((d) => d.principal)).toEqual([
        "system",
        "user:user-1",
      ]);
      const renewedBy = await harness.prisma.certificate.findUniqueOrThrow({
        where: { id: renewal!.certificateId },
      });
      expect(renewedBy.renewsId).toBe(first.id);

      // Renewed, it needs no renewal: no alert for it until it expires.
      const metrics = await request(server()).get("/metrics").expect(200);
      expect(metrics.text).toMatch(
        new RegExp(
          `certificate_expiry_days\\{[^}]*serial="${first.serial}",renewal="renewed"`,
        ),
      );
      const renewalSerial = (
        await harness.prisma.certificate.findUniqueOrThrow({
          where: { id: renewal!.certificateId },
        })
      ).serial;
      // Its renewal, the target's now, is Harpocrates's to renew.
      expect(metrics.text).toMatch(
        new RegExp(
          `certificate_expiry_days\\{[^}]*serial="${renewalSerial}",renewal="automatic"`,
        ),
      );
    });

    it("by anyone else is followed too", async () => {
      const current = await describeTarget(target.id);
      const renewed = await request(server())
        .post(`/v1/certificate/${current.certificateId}/renew`)
        .set("Authorization", harness.operator)
        .send({})
        .expect(201);
      const renewal = (renewed.body as { certificate: { id: string } })
        .certificate;
      const run = await scheduler().run();
      expect(run.followed).toEqual([
        { target: "renewed", certificateId: renewal.id },
      ]);
      expect(installed("renewed").marker).toContain(
        `certificate=${renewal.id}`,
      );
    });
  });

  describe("by hand", () => {
    let target: Target;

    beforeAll(async () => {
      const certificate = await hostCertificate("hand.internal.ncfritz.net");
      target = (
        (await createTarget("hand", certificate.id).expect(201)).body as {
          deployTarget: Target;
        }
      ).deployTarget;
    });

    it("deploys again, after the files were lost", async () => {
      fs.rmSync(path.join(deployDir, "hand"), { recursive: true });
      const redeployed = await request(server())
        .post(`/v1/deploy-target/${target.id}/deploy`)
        .set("Authorization", harness.operator)
        .expect(200);
      expect(
        (redeployed.body as { deployTarget: Target }).deployTarget
          .lastDeployment,
      ).toMatchObject({
        status: "deployed",
        certificateId: target.certificateId,
      });
      expect(installed("hand").files).toContain("fullchain.pem");
    });

    it("moves to a reissue", async () => {
      const reissue = await hostCertificate("hand.internal.ncfritz.net");
      await request(server())
        .put(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.operator)
        .send({ certificateId: reissue.id })
        .expect(403);
      const updated = await request(server())
        .put(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.admin)
        .send({ certificateId: reissue.id })
        .expect(200);
      expect(
        (updated.body as { deployTarget: Target }).deployTarget,
      ).toMatchObject({
        certificateId: reissue.id,
        lastDeployment: { status: "deployed", serial: reissue.serial },
      });
      expect(BigInt(`0x${installed("hand").certificate.serialNumber}`)).toBe(
        BigInt(`0x${reissue.serial}`),
      );
    });

    it("is deleted, leaving its files for the web server", async () => {
      await request(server())
        .delete(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.operator)
        .expect(403);
      await request(server())
        .delete(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.admin)
        .expect(204);
      await request(server())
        .get(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.operator)
        .expect(404);
      expect(installed("hand").files).toContain("privkey.pem");
      expect(
        await harness.prisma.auditEvent.count({
          where: { subjectId: target.id, kind: "deploy-target.deleted" },
        }),
      ).toBe(1);
    });
  });

  describe("its endpoint", () => {
    let target: Target;
    let first: { id: string; serial: string };
    let web: https.Server;
    const SETTLE = 30_000;

    /** What nginx would serve from the target's files, read when told. */
    const serve = (name: string) => {
      const dir = path.join(deployDir, name);
      return {
        cert: fs.readFileSync(path.join(dir, "fullchain.pem")),
        key: fs.readFileSync(path.join(dir, "privkey.pem")),
      };
    };

    const check = async () =>
      (
        (
          await request(server())
            .post(`/v1/deploy-target/${target.id}/check`)
            .set("Authorization", harness.operator)
            .expect(200)
        ).body as { deployTarget: Target }
      ).deployTarget;

    beforeAll(async () => {
      web = https.createServer({}, (_, response) => response.end());
      await new Promise<void>((resolve) => web.listen(0, "127.0.0.1", resolve));
      const { port } = web.address() as AddressInfo;
      first = await hostCertificate("web.internal.ncfritz.net");
      const created = await request(server())
        .post("/v1/deploy-targets")
        .set("Authorization", harness.admin)
        .send({
          name: "web",
          certificateId: first.id,
          endpoint: `127.0.0.1:${port}`,
        })
        .expect(201);
      target = (created.body as { deployTarget: Target }).deployTarget;
      web.setSecureContext(serve("web"));
    });

    afterAll(() => {
      web.closeAllConnections();
      web.close();
    });

    it("is checked once the deployment has had time to land", async () => {
      const soon = await scheduler().run(new Date(Date.now() + 10_000));
      expect(soon.checked.map((c) => c.target)).not.toContain("web");
      const landed = await scheduler().run(new Date(Date.now() + SETTLE + 1));
      expect(landed.checked).toContainEqual({
        target: "web",
        result: "current",
      });
      const again = await scheduler().run(new Date(Date.now() + SETTLE + 2));
      expect(again.checked.map((c) => c.target)).not.toContain("web");
      const described = await describeTarget(target.id);
      expect(described.lastObservation).toMatchObject({
        endpoint: target.endpoint,
        result: "current",
        expectedCertificateId: first.id,
        servedCertificateId: first.id,
        servedSerial: first.serial,
        checks: 1,
      });
    });

    it("says when nginx still serves the certificate before a renewal", async () => {
      const run = await scheduler().run(new Date(Date.now() + 61 * DAY));
      const renewal = run.renewed.find((r) => r.target === "web")!;
      expect(renewal).toBeDefined();
      expect(run.checked).toContainEqual({ target: "web", result: "previous" });
      const described = await describeTarget(target.id);
      expect(described.lastObservation).toMatchObject({
        result: "previous",
        expectedCertificateId: renewal.certificateId,
        servedCertificateId: first.id,
      });

      // nginx reloads.
      web.setSecureContext(serve("web"));
      const reloaded = await check();
      expect(reloaded.lastObservation).toMatchObject({
        result: "current",
        servedCertificateId: renewal.certificateId,
      });
      // The same answer again is the same row, seen once more.
      const same = await check();
      expect(same.lastObservation?.checks).toBe(2);
      expect(same.observations.map((o) => o.result)).toEqual([
        "current",
        "previous",
        "current",
      ]);
    });

    it("says when it serves another certificate", async () => {
      web.setSecureContext(serve("nas.internal.ncfritz.net"));
      const other = await check();
      expect(other.lastObservation).toMatchObject({ result: "other" });
      expect(other.lastObservation?.servedCertificateId).toBeUndefined();
      web.setSecureContext(serve("web"));
    });

    it("records whether it staples, asking a must-staple certificate's endpoint twice", async () => {
      // What it staples is not checked: only that something is.
      let asked = 0;
      const staple = (
        _certificate: Buffer,
        _issuer: Buffer,
        callback: (error: Error | null, response?: Buffer) => void,
      ) => {
        asked += 1;
        // Like nginx: nothing on the first handshake, fetched for the next.
        callback(
          null,
          asked > 1 ? Buffer.from([0x30, 0x03, 0x0a, 0x01, 0x00]) : undefined,
        );
      };
      web.on("OCSPRequest", staple);
      try {
        // The target's certificate need not be stapled: asked once.
        const plain = await check();
        expect(plain.lastObservation).toMatchObject({
          result: "current",
          servedMustStaple: false,
          stapled: false,
        });
        expect(asked).toBe(1);
        const stapled = await check();
        expect(stapled.lastObservation).toMatchObject({ stapled: true });

        // A must-staple certificate: asked again when nothing came.
        asked = 0;
        const mustStaple = await selfSignedTls(
          "staple.internal.ncfritz.net",
          [5],
        );
        web.setSecureContext({ cert: mustStaple.cert, key: mustStaple.key });
        const retried = await check();
        expect(asked).toBe(2);
        expect(retried.lastObservation).toMatchObject({
          result: "other",
          servedMustStaple: true,
          stapled: true,
        });
        let metrics = await request(server()).get("/metrics").expect(200);
        expect(metrics.text).toMatch(
          /harpocrates_deploy_target_stapling\{target="web",must_staple="true"[^}]*\} 1\n/,
        );

        // Never stapled: recorded, and the gauge the alert reads says so.
        web.off("OCSPRequest", staple);
        const unstapled = await check();
        expect(unstapled.lastObservation).toMatchObject({
          servedMustStaple: true,
          stapled: false,
        });
        metrics = await request(server()).get("/metrics").expect(200);
        expect(metrics.text).toMatch(
          /harpocrates_deploy_target_stapling\{target="web",must_staple="true"[^}]*\} 0\n/,
        );
      } finally {
        web.off("OCSPRequest", staple);
        web.setSecureContext(serve("web"));
      }
    });

    it("says when nothing answers, and the gauges say so too", async () => {
      web.closeAllConnections();
      await new Promise<void>((resolve) => web.close(() => resolve()));
      const down = await check();
      expect(down.lastObservation).toMatchObject({
        result: "unreachable",
        error: expect.stringMatching(/ECONNREFUSED/),
      });
      const metrics = await request(server()).get("/metrics").expect(200);
      // The registry adds its own labels (app, environment) after these.
      expect(metrics.text).toMatch(
        /harpocrates_deploy_target_serving\{target="web",result="unreachable"[^}]*\} 1\n/,
      );
      expect(metrics.text).toMatch(
        /harpocrates_deploy_target_serving\{target="web",result="current"[^}]*\} 0\n/,
      );
      expect(metrics.text).toMatch(
        /harpocrates_deploy_target_checked_timestamp_seconds\{target="web"[^}]*\} \d+/,
      );
    });

    it("moves, without a deployment", async () => {
      await request(server())
        .put(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.admin)
        .send({ endpoint: "nope" })
        .expect(400);
      await request(server())
        .put(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.admin)
        .send({ endpoint: "web.internal.ncfritz.net:70000" })
        .expect(400);
      await request(server())
        .put(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.admin)
        .send({})
        .expect(400);
      const before = await describeTarget(target.id);
      const moved = await request(server())
        .put(`/v1/deploy-target/${target.id}`)
        .set("Authorization", harness.admin)
        .send({ endpoint: "web.internal.ncfritz.net:8443" })
        .expect(200);
      const after = (moved.body as { deployTarget: Target }).deployTarget;
      expect(after.endpoint).toBe("web.internal.ncfritz.net:8443");
      expect(after.deployments).toEqual(before.deployments);
      const audited = await harness.prisma.auditEvent.findFirstOrThrow({
        where: { subjectId: target.id, kind: "deploy-target.updated" },
        include: { attributes: true },
      });
      expect(
        Object.fromEntries(audited.attributes.map((a) => [a.name, a.value])),
      ).toMatchObject({ endpoint: "web.internal.ncfritz.net:8443" });
    });
  });
});
