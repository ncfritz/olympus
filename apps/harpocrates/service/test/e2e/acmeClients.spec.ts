import { spawn, spawnSync } from "child_process";
import { X509Certificate } from "crypto";
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import * as tls from "tls";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OID } from "../../src/pki/x509";
import { RenewalListener } from "../../src/renewal/services/RenewalListener";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  freePort,
  type Hierarchy,
  startHarness,
  type Harness,
} from "../support/e2e";

/**
 * The ACME clients ADR 0020 names (certbot, lego, acme.sh, Caddy), each
 * registering with a binding, issuing, renewing and revoking against the
 * renewal listener. Opt-in: ACME_INTEROP_BIN names a directory holding
 * `certbot`, `lego`, `acme.sh` and `caddy` (any missing is skipped);
 * acme.sh's standalone mode needs socat. See README.md, ACME.
 */
const BIN = process.env.ACME_INTEROP_BIN;
const has = (name: string) =>
  Boolean(BIN && fs.existsSync(path.join(BIN, name)));

/** The listener is local: past any proxy the environment configures. */
const LOCAL = {
  NO_PROXY: "localhost,127.0.0.1",
  no_proxy: "localhost,127.0.0.1",
};

describe.skipIf(!E2E_DATABASE_URL || !BIN)("ACME clients", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  let directoryUrl: string;
  let httpPort: number;
  let tlsPort: number;
  let work: string;
  let rootFile: string;
  const server = () => harness.app.getHttpServer();

  const credential = async (label: string) =>
    (
      await request(server())
        .post("/v1/acme/credentials")
        .set("Authorization", harness.admin)
        .send({ label, names: { subtrees: ["lab.internal.ncfritz.net"] } })
        .expect(201)
    ).body as { credential: { id: string }; hmacKey: string };

  /**
   * Runs a client to completion; its output on failure. Asynchronously:
   * the service under test answers it from this same process.
   */
  const run = (
    command: string,
    args: string[],
    env: Record<string, string> = {},
  ): Promise<string> =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        env: { ...process.env, ...LOCAL, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      child.stdout.on("data", (d: Buffer) => (output += d.toString()));
      child.stderr.on("data", (d: Buffer) => (output += d.toString()));
      const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
      child.on("close", (status) => {
        clearTimeout(timer);
        if (status === 0) resolve(output);
        else
          reject(
            new Error(
              `${path.basename(command)} ${args[0]} exited ${status}:\n${output.slice(-4000)}`,
            ),
          );
      });
    });

  /** The ACME certificate Harpocrates issued for a name, newest first. */
  const issuedFor = (name: string) =>
    harness.prisma.certificate.findMany({
      where: {
        acmeOrder: { isNot: null },
        enrollment: { names: { some: { value: name } } },
      },
      include: { revocation: true },
      orderBy: { createdAt: "desc" },
    });

  beforeAll(async () => {
    const port = await freePort();
    httpPort = await freePort();
    tlsPort = await freePort();
    work = fs.mkdtempSync(path.join("/tmp", "hrp-acme-clients-"));
    harness = await startHarness({
      env: {
        RENEWAL_LISTEN_PORT: String(port),
        RENEWAL_TLS_DIR: path.join(work, "tls"),
        RENEWAL_HOSTNAMES: "localhost",
        ACME_CHALLENGE_RESOLVE: "127.0.0.1",
        ACME_HTTP_PORT: String(httpPort),
        ACME_TLS_ALPN_PORT: String(tlsPort),
      },
    });
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
      {
        purpose: "Service",
        extendedKeyUsages: [OID.clientAuth, OID.serverAuth],
      },
    ]);
    await harness.app.get(RenewalListener).check();
    directoryUrl = `https://localhost:${port}/acme/directory`;
    rootFile = path.join(work, "root.pem");
    fs.writeFileSync(rootFile, hierarchy.root.certificate);
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
    fs.rmSync(work, { recursive: true, force: true });
  });

  it.skipIf(!has("certbot"))(
    "certbot: http-01, renewal and revocation",
    async () => {
      const name = "certbot.lab.internal.ncfritz.net";
      const { credential: c, hmacKey } = await credential("certbot");
      const dirs = ["config", "work", "logs"].flatMap((d) => [
        `--${d}-dir`,
        path.join(work, "certbot", d),
      ]);
      const certbot = path.join(BIN!, "certbot");
      const env = { REQUESTS_CA_BUNDLE: rootFile };
      const common = [...dirs, "--non-interactive", "--server", directoryUrl];
      await run(
        certbot,
        [
          "certonly",
          ...common,
          "--agree-tos",
          "--email",
          "ops@example.test",
          "--eab-kid",
          c.id,
          "--eab-hmac-key",
          hmacKey,
          "--standalone",
          "--http-01-address",
          "127.0.0.1",
          "--http-01-port",
          String(httpPort),
          "--key-type",
          "ecdsa",
          "-d",
          name,
        ],
        env,
      );
      expect(await issuedFor(name)).toHaveLength(1);
      await run(
        certbot,
        [
          "renew",
          ...common,
          "--force-renewal",
          "--no-random-sleep-on-renew",
          "--cert-name",
          name,
        ],
        env,
      );
      expect(await issuedFor(name)).toHaveLength(2);
      await run(
        certbot,
        [
          "revoke",
          ...common,
          "--cert-name",
          name,
          "--reason",
          "superseded",
          "--no-delete-after-revoke",
        ],
        env,
      );
      const [newest] = await issuedFor(name);
      expect(newest.revocation?.reason).toBe("superseded");
    },
    300_000,
  );

  it.skipIf(!has("lego"))(
    "lego: http-01 and tls-alpn-01, renewal and revocation",
    async () => {
      const { credential: c, hmacKey } = await credential("lego");
      const lego = path.join(BIN!, "lego");
      const env = { LEGO_CA_CERTIFICATES: rootFile };
      const common = [
        "--accept-tos",
        "--email",
        "ops@example.test",
        "--server",
        directoryUrl,
        "--eab",
        "--kid",
        c.id,
        "--hmac",
        hmacKey,
        "--path",
        path.join(work, "lego"),
      ];
      const http = "lego-http.lab.internal.ncfritz.net";
      const alpn = "lego-alpn.lab.internal.ncfritz.net";
      const viaHttp = ["--http", "--http.port", `127.0.0.1:${httpPort}`];
      await run(lego, [...common, "--domains", http, ...viaHttp, "run"], env);
      await run(
        lego,
        [
          ...common,
          "--domains",
          alpn,
          "--tls",
          "--tls.port",
          `127.0.0.1:${tlsPort}`,
          "run",
        ],
        env,
      );
      expect(await issuedFor(http)).toHaveLength(1);
      expect(await issuedFor(alpn)).toHaveLength(1);
      await run(
        lego,
        [
          ...common,
          "--domains",
          http,
          ...viaHttp,
          "renew",
          "--days",
          "90",
          "--no-random-sleep",
        ],
        env,
      );
      expect(await issuedFor(http)).toHaveLength(2);
      await run(
        lego,
        [...common, "--domains", http, "revoke", "--reason", "4"],
        env,
      );
      const [newest] = await issuedFor(http);
      expect(newest.revocation?.reason).toBe("superseded");
    },
    300_000,
  );

  it.skipIf(!has("acme.sh") || spawnSync("which", ["socat"]).status !== 0)(
    "acme.sh: http-01 and tls-alpn-01, renewal and revocation",
    async () => {
      const { credential: c, hmacKey } = await credential("acme.sh");
      const home = path.join(work, "acme.sh");
      fs.mkdirSync(home, { recursive: true });
      const acmeSh = path.join(BIN!, "acme.sh");
      const common = [
        "--home",
        home,
        "--config-home",
        home,
        "--server",
        directoryUrl,
        "--ca-bundle",
        rootFile,
      ];
      await run("sh", [
        acmeSh,
        ...common,
        "--register-account",
        "-m",
        "ops@example.test",
        "--eab-kid",
        c.id,
        "--eab-hmac-key",
        hmacKey,
      ]);
      const http = "acmesh-http.lab.internal.ncfritz.net";
      const alpn = "acmesh-alpn.lab.internal.ncfritz.net";
      await run("sh", [
        acmeSh,
        ...common,
        "--issue",
        "-d",
        http,
        "--standalone",
        "--httpport",
        String(httpPort),
        "--keylength",
        "ec-256",
      ]);
      await run("sh", [
        acmeSh,
        ...common,
        "--issue",
        "-d",
        alpn,
        "--alpn",
        "--tlsport",
        String(tlsPort),
        "--keylength",
        "ec-256",
      ]);
      expect(await issuedFor(http)).toHaveLength(1);
      expect(await issuedFor(alpn)).toHaveLength(1);
      await run("sh", [
        acmeSh,
        ...common,
        "--renew",
        "-d",
        http,
        "--force",
        "--ecc",
      ]);
      expect(await issuedFor(http)).toHaveLength(2);
      await run("sh", [acmeSh, ...common, "--revoke", "-d", http, "--ecc"]);
      const [newest] = await issuedFor(http);
      expect(newest.revocation).not.toBeNull();
    },
    300_000,
  );

  it.skipIf(!has("caddy"))(
    "Caddy: obtains and serves a certificate by itself",
    async () => {
      const { credential: c, hmacKey } = await credential("Caddy");
      const name = "caddy.lab.internal.ncfritz.net";
      const dir = path.join(work, "caddy");
      fs.mkdirSync(dir, { recursive: true });
      const caddyfile = path.join(dir, "Caddyfile");
      fs.writeFileSync(
        caddyfile,
        [
          "{",
          "  admin off",
          `  http_port ${httpPort}`,
          `  https_port ${tlsPort}`,
          "  email ops@example.test",
          `  acme_ca ${directoryUrl}`,
          `  acme_ca_root ${rootFile}`,
          "  acme_eab {",
          `    key_id ${c.id}`,
          `    mac_key ${hmacKey}`,
          "  }",
          "  skip_install_trust",
          `  storage file_system ${path.join(dir, "data")}`,
          "}",
          `${name} {`,
          '  respond "served by Caddy"',
          "}",
          "",
        ].join("\n"),
      );
      const caddy = spawn(
        path.join(BIN!, "caddy"),
        ["run", "--config", caddyfile, "--adapter", "caddyfile"],
        {
          env: { ...process.env, HOME: dir },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let log = "";
      caddy.stdout.on("data", (d: Buffer) => (log += d.toString()));
      caddy.stderr.on("data", (d: Buffer) => (log += d.toString()));
      try {
        await vi
          .waitFor(async () => expect(await issuedFor(name)).toHaveLength(1), {
            timeout: 90_000,
            interval: 1_000,
          })
          .catch((error: unknown) => {
            throw new Error(`${String(error)}\n${log.slice(-4000)}`);
          });
        // What it serves is what Harpocrates issued.
        const [issued] = await issuedFor(name);
        const served = await vi.waitFor(
          () =>
            new Promise<X509Certificate>((resolve, reject) => {
              const socket = tls.connect(
                {
                  host: "127.0.0.1",
                  port: tlsPort,
                  servername: name,
                  ca: hierarchy.root.certificate,
                },
                () => {
                  resolve(new X509Certificate(socket.getPeerCertificate().raw));
                  socket.destroy();
                },
              );
              socket.on("error", reject);
            }),
          { timeout: 20_000, interval: 500 },
        );
        expect(served.raw.equals(Buffer.from(issued.der))).toBe(true);
      } finally {
        caddy.kill("SIGTERM");
      }
    },
    180_000,
  );
});
