import { spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OID } from "../../src/pki/x509";
import { RenewalListener } from "../../src/renewal/services/RenewalListener";
import { SshKrlService } from "../../src/ssh/services/SshKrlService";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  freePort,
  type Hierarchy,
  startHarness,
  type Harness,
} from "../support/e2e";
import { sshSign, sshTestKey, type SshTestKey } from "../support/ssh";

const NAMESPACE = "harpocrates-ssh-renew";
const DAY = 24 * 60 * 60 * 1000;
const SCRIPT = path.resolve(__dirname, "../../../hosts/harpocrates-ssh-host");

const has = (command: string) =>
  spawnSync(command, ["--version"]).error === undefined;
const hasTools = has("ssh-keygen") && has("curl");

type Certificate = {
  id: string;
  type: string;
  principals: string[];
  state: string;
  certificate: string;
  fingerprint: string;
  validAfter: string;
};

type Challenge = {
  id: string;
  nonce: string;
  namespace: string;
  due: boolean;
  renewAt: string;
  expiresAt: string;
};

/**
 * SSH hosts renew by proving their host key (ADR 0035, phase 9 step 4):
 * a challenge for the current certificate, signed with the host key, on
 * the renewal listener and nowhere else.
 */
describe.skipIf(!E2E_DATABASE_URL)("ssh host renewal", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  let port: number;
  const server = () => harness.app.getHttpServer();

  /** A POST on the renewal listener, with no credential. */
  const post = (
    route: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; body: Record<string, unknown> }> =>
    new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = https.request(
        {
          host: "localhost",
          port,
          path: route,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
          ca: hierarchy.root.certificate,
        },
        (response) => {
          let text = "";
          response.on("data", (chunk: Buffer) => (text += chunk.toString()));
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
            }),
          );
        },
      );
      req.on("error", reject);
      req.end(payload);
    });

  const challengeFor = async (certificate: string, status = 201) => {
    const response = await post("/v1/ssh/host-renewals/challenges", {
      certificate,
    });
    expect(response.status, JSON.stringify(response.body)).toBe(status);
    return response.body.challenge as Challenge;
  };

  const renew = (challengeId: string, signature: string) =>
    post("/v1/ssh/host-renewals", { challengeId, signature });

  /** A host certificate, issued by an admin, for a key held here. */
  const issueHost = async (name: string) => {
    const key = sshTestKey(`root@${name}`);
    const issued = await request(server())
      .post("/v1/ssh/certificates/host")
      .set("Authorization", harness.admin)
      .send({
        publicKey: key.publicKey,
        principals: [`${name}.internal.ncfritz.net`, name],
      })
      .expect(201);
    return {
      key,
      certificate: (issued.body as { certificate: Certificate }).certificate,
    };
  };

  /** Makes a certificate due: as if issued 61 days ago (ssh-host renews at 60). */
  const makeDue = (id: string) =>
    harness.prisma.sshCertificate.update({
      where: { id },
      data: { validAfter: new Date(Date.now() - 61 * DAY) },
    });

  const signed = (key: SshTestKey, challenge: Challenge) =>
    sshSign(key, challenge.nonce, challenge.namespace);

  beforeAll(async () => {
    port = await freePort();
    const dir = fs.mkdtempSync(path.join("/tmp", "hrp-ssh-renewal-"));
    harness = await startHarness({
      env: {
        RENEWAL_LISTEN_PORT: String(port),
        RENEWAL_TLS_DIR: path.join(dir, "tls"),
        RENEWAL_HOSTNAMES: "localhost",
      },
    });
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
    ]);
    await harness.app.get(RenewalListener).check();
    for (const type of ["user", "host"]) {
      await request(server())
        .post("/v1/ssh/cas")
        .set("Authorization", harness.admin)
        .send({ type })
        .expect(201);
    }
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("renews a due certificate for the key that signed the challenge", async () => {
    const { key, certificate } = await issueHost("mini");
    const early = await challengeFor(certificate.certificate);
    expect(early).toMatchObject({ namespace: NAMESPACE, due: false });
    expect(Date.parse(early.renewAt) - Date.parse(certificate.validAfter)).toBe(
      60 * DAY,
    );
    // Not due: refused, and the challenge is spent.
    expect((await renew(early.id, signed(key, early))).status).toBe(409);
    expect((await renew(early.id, signed(key, early))).status).toBe(403);

    await makeDue(certificate.id);
    const challenge = await challengeFor(certificate.certificate);
    expect(challenge.due).toBe(true);
    const renewed = await renew(challenge.id, signed(key, challenge));
    expect(renewed.status, JSON.stringify(renewed.body)).toBe(201);
    const next = renewed.body.certificate as Certificate;
    expect(next).toMatchObject({
      type: "host",
      principals: ["mini.internal.ncfritz.net", "mini"],
      fingerprint: certificate.fingerprint,
      state: "valid",
    });
    expect(next.id).not.toBe(certificate.id);

    // The old one is spent; the new one is the one to renew.
    await challengeFor(certificate.certificate, 409);
    expect((await challengeFor(next.certificate)).due).toBe(false);
    const row = await harness.prisma.sshCertificate.findUniqueOrThrow({
      where: { id: next.id },
    });
    expect(row.renewsId).toBe(certificate.id);
    expect(
      await harness.prisma.auditEvent.findFirstOrThrow({
        where: { kind: "ssh-certificate.renewed", subjectId: next.id },
      }),
    ).toMatchObject({
      principal: "ssh-host:mini.internal.ncfritz.net",
      surface: "renewal",
    });
  });

  it("refuses a signature by another key, in another namespace, or used twice", async () => {
    const { key, certificate } = await issueHost("nas");
    await makeDue(certificate.id);

    let challenge = await challengeFor(certificate.certificate);
    const other = await renew(
      challenge.id,
      sshSign(sshTestKey(), challenge.nonce, NAMESPACE),
    );
    expect(other.status).toBe(403);
    expect(String(other.body.message)).toMatch(/not signed by the certificate/);

    challenge = await challengeFor(certificate.certificate);
    const namespace = await renew(
      challenge.id,
      sshSign(key, challenge.nonce, "file"),
    );
    expect(namespace.status).toBe(403);
    expect(String(namespace.body.message)).toMatch(/signed for file/);

    challenge = await challengeFor(certificate.certificate);
    const wrongNonce = await renew(
      challenge.id,
      sshSign(key, "something else", NAMESPACE),
    );
    expect(wrongNonce.status).toBe(403);

    expect((await renew("no-such-challenge", "x")).status).toBe(400);
    expect(
      (await renew("00000000-0000-4000-8000-000000000000", "x")).status,
    ).toBe(403);
    challenge = await challengeFor(certificate.certificate);
    await harness.prisma.sshRenewalChallenge.update({
      where: { id: challenge.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await renew(challenge.id, signed(key, challenge))).status).toBe(
      403,
    );
  });

  it("does not renew an unknown, revoked or expired certificate", async () => {
    const unknown = sshTestKey();
    await challengeFor(
      `ssh-ed25519-cert-v01@openssh.com ${unknown.blob.toString("base64")}`,
      404,
    );

    const revoked = await issueHost("laptop");
    await request(server())
      .post(`/v1/ssh/certificate/${revoked.certificate.id}/revoke`)
      .set("Authorization", harness.operator)
      .send({})
      .expect(200);
    await challengeFor(revoked.certificate.certificate, 403);

    const expired = await issueHost("printer");
    await makeDue(expired.certificate.id);
    const challenge = await challengeFor(expired.certificate.certificate);
    await harness.prisma.sshCertificate.update({
      where: { id: expired.certificate.id },
      data: { validBefore: new Date(Date.now() - 1000) },
    });
    await challengeFor(expired.certificate.certificate, 422);
    expect(
      (await renew(challenge.id, signed(expired.key, challenge))).status,
    ).toBe(422);
  });

  it("serves renewal on the renewal listener only", async () => {
    const { certificate } = await issueHost("router");
    await request(server())
      .post("/v1/ssh/host-renewals/challenges")
      .send({ certificate: certificate.certificate })
      .expect(404);
    await request(server())
      .post("/v1/ssh/host-renewals")
      .set("Authorization", harness.admin)
      .send({
        challengeId: "00000000-0000-4000-8000-000000000000",
        signature: "x",
      })
      .expect(404);
  });

  describe.skipIf(!hasTools)("the host script", () => {
    let dir: string;
    /** The script, run apart: the service it calls is in this process. */
    const run = (
      command: string,
      env: Record<string, string>,
    ): Promise<{ status: number | null; stderr: string }> =>
      new Promise((resolve, reject) => {
        const child = spawn("sh", [SCRIPT, command], {
          env: {
            PATH: process.env.PATH,
            HARPOCRATES_SSH_HOST_CONFIG: "/dev/null",
            HARPOCRATES_CA_FILE: path.join(dir, "root.pem"),
            ...env,
          },
        });
        let stderr = "";
        child.stderr.on(
          "data",
          (chunk: Buffer) => (stderr += chunk.toString()),
        );
        child.stdout.resume();
        child.on("error", reject);
        child.on("close", (status) => resolve({ status, stderr }));
      });

    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(harness.dir, "host-"));
      fs.writeFileSync(path.join(dir, "root.pem"), hierarchy.root.certificate);
    });

    it("renews once due, writing the certificate and restarting sshd", async () => {
      const { key, certificate } = await issueHost("pi");
      const hostKey = path.join(dir, "ssh_host_ed25519_key");
      fs.writeFileSync(hostKey, key.privateKeyFile, { mode: 0o600 });
      fs.writeFileSync(`${hostKey}-cert.pub`, `${certificate.certificate}\n`);
      const env = {
        HARPOCRATES_RENEWAL_URL: `https://localhost:${port}`,
        HOST_KEY: hostKey,
        RESTART_COMMAND: `touch ${path.join(dir, "restarted")}`,
      };

      const early = await run("renew", env);
      expect(early.status, early.stderr).toBe(0);
      expect(early.stderr).toMatch(/not due until /);
      expect(fs.existsSync(path.join(dir, "restarted"))).toBe(false);

      await makeDue(certificate.id);
      const renewed = await run("renew", env);
      expect(renewed.status, renewed.stderr).toBe(0);
      expect(renewed.stderr).toMatch(/renewed /);
      expect(fs.existsSync(path.join(dir, "restarted"))).toBe(true);
      const written = fs.readFileSync(`${hostKey}-cert.pub`, "utf8");
      expect(written).not.toBe(`${certificate.certificate}\n`);
      const listing = spawnSync(
        "ssh-keygen",
        ["-L", "-f", `${hostKey}-cert.pub`],
        { encoding: "utf8" },
      ).stdout;
      expect(listing).toMatch(/host certificate/);
      expect(listing).toMatch(/pi\.internal\.ncfritz\.net\n\s+pi/);

      // The old certificate, given again: refused, and said why.
      fs.writeFileSync(`${hostKey}-cert.pub`, `${certificate.certificate}\n`);
      const again = await run("renew", env);
      expect(again.status).toBe(1);
      expect(again.stderr).toMatch(/HTTP 409.*renewed already/);
    });

    it("fetches the user CA's KRL, and installs only a KRL", async () => {
      await harness.app.get(SshKrlService).writeDue();
      const cas = await request(server())
        .get("/v1/ssh/cas")
        .set("Authorization", harness.operator)
        .expect(200);
      const user = (
        cas.body as { cas: { type: string; krlUrl: string }[] }
      ).cas.find((c) => c.type === "user")!;
      const krlUrl = user.krlUrl.replace(
        /^.*\/krl\//,
        `${harness.distribution.url}/krl/`,
      );
      const krlFile = path.join(dir, "revoked_keys");
      const fetched = await run("krl", { KRL_URL: krlUrl, KRL_FILE: krlFile });
      expect(fetched.status, fetched.stderr).toBe(0);
      expect(fs.readFileSync(krlFile).subarray(0, 6).toString()).toBe("SSHKRL");

      const notKrl = await run("krl", {
        KRL_URL: `${harness.distribution.url}/ca/nothing.crt`,
        KRL_FILE: krlFile,
      });
      expect(notKrl.status).toBe(1);
      expect(fs.readFileSync(krlFile).subarray(0, 6).toString()).toBe("SSHKRL");
    });
  });
});
