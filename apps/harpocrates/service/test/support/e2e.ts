import type { INestApplication } from "@nestjs/common";
import * as x509 from "@peculiar/x509";
import { spawn, execFileSync, type ChildProcess } from "child_process";
import { randomBytes, webcrypto } from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "./app";
import { bearer } from "./tokens";

x509.cryptoProvider.set(webcrypto as unknown as Crypto);

const SERVICE_DIR = path.resolve(__dirname, "../..");
const SIGNER_DIR = path.resolve(SERVICE_DIR, "../signer");

export const RECOVERY_PASSPHRASE = "correct horse battery staple";
export const EXPORT_PASSPHRASE = "offline media passphrase";

/**
 * The database the e2e project may create schemas in. Unset: the suite is
 * skipped, so `pnpm test:e2e` without a Postgres says so instead of failing.
 */
export const E2E_DATABASE_URL = process.env.HARPOCRATES_E2E_DATABASE_URL;

/**
 * The distribution host, as nginx serves the published directory: plain
 * HTTP, static files, no redirects. Stoppable, to make publication fail.
 */
export class DistributionServer {
  private server?: http.Server;
  port = 0;
  /** Requests answered with this instead of the file, by path. */
  readonly overrides = new Map<string, Buffer>();

  constructor(readonly root: string) {}

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      const route = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const override = this.overrides.get(route);
      const file = path.join(this.root, path.normalize(route));
      if (!override && (!file.startsWith(this.root) || !fs.existsSync(file))) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": route.endsWith(".crl")
          ? "application/pkix-crl"
          : "application/pkix-cert",
      });
      res.end(override ?? fs.readFileSync(file));
    });
    await new Promise<void>((resolve) =>
      this.server!.listen(this.port, "127.0.0.1", resolve),
    );
    this.port = (this.server.address() as { port: number }).port;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export type Harness = {
  app: INestApplication;
  prisma: PrismaClient;
  dir: string;
  /** The published directory and the server in front of it. */
  published: string;
  distribution: DistributionServer;
  admin: string;
  operator: string;
  close: () => Promise<void>;
};

const signerCall = (
  socketPath: string,
  token: string,
  method: string,
  route: string,
  body?: unknown,
): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        socketPath,
        method,
        path: route,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: data }),
        );
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });

const waitForSigner = async (
  child: ChildProcess,
  socketPath: string,
  token: string,
) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`The signer exited with ${child.exitCode}`);
    }
    if (fs.existsSync(socketPath)) {
      try {
        const health = await signerCall(socketPath, token, "GET", "/health");
        if (health.status === 200) return;
      } catch {
        // not listening yet
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("The signer did not come up within a minute");
};

/**
 * The service against a fresh schema in the e2e database and its own
 * signer: spawned from ../signer with uv on a temporary store, initialised,
 * and unsealed.
 */
export const startHarness = async (
  options: { initialise?: boolean } = {},
): Promise<Harness> => {
  if (!E2E_DATABASE_URL)
    throw new Error("HARPOCRATES_E2E_DATABASE_URL is unset");

  // An AF_UNIX path is at most 104 bytes on macOS: stay under /tmp.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hrp-e2e-"));
  const token = randomBytes(32).toString("base64url");
  const tokenFile = path.join(dir, "token");
  const socketPath = path.join(dir, "signer.sock");
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });

  const signer = spawn(
    "uv",
    [
      "run",
      "--locked",
      "--project",
      SIGNER_DIR,
      "python",
      "-m",
      "harpocrates_signer",
      "serve",
    ],
    {
      cwd: SIGNER_DIR,
      env: {
        ...process.env,
        SIGNER_SOCKET_PATH: socketPath,
        SIGNER_STORE_PATH: path.join(dir, "store", "signer.db"),
        SIGNER_TOKEN_FILE: tokenFile,
        SIGNER_UNSEAL_KEY_FILE: path.join(dir, "unseal-key"),
        SIGNER_CEREMONY_TIMEOUT_SECONDS: "600",
        SIGNER_LOG_LEVEL: process.env.TEST_SIGNER_LOGS ? "DEBUG" : "ERROR",
      },
      stdio: process.env.TEST_SIGNER_LOGS ? "inherit" : "ignore",
    },
  );

  try {
    await waitForSigner(signer, socketPath, token);
    if (options.initialise !== false) {
      const initialised = await signerCall(
        socketPath,
        token,
        "POST",
        "/v1/initialise",
        {
          passphrase: RECOVERY_PASSPHRASE,
        },
      );
      if (initialised.status !== 201) {
        throw new Error(
          `initialise: ${initialised.status} ${initialised.body}`,
        );
      }
      const { unsealKey } = JSON.parse(initialised.body) as {
        unsealKey: string;
      };
      fs.writeFileSync(path.join(dir, "unseal-key"), unsealKey, {
        mode: 0o600,
      });
    }

    const schema = `e2e_${randomBytes(6).toString("hex")}`;
    const url = new URL(E2E_DATABASE_URL);
    url.searchParams.set("schema", schema);
    const databaseUrl = url.toString();
    execFileSync(
      process.execPath,
      [
        path.join(SERVICE_DIR, "node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
      ],
      {
        cwd: SERVICE_DIR,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "ignore",
      },
    );

    const published = path.join(dir, "published");
    fs.mkdirSync(published);
    const distribution = new DistributionServer(published);
    await distribution.start();

    process.env.DATABASE_URL = databaseUrl;
    process.env.PKI_PUBLISHED_DIR = published;
    process.env.PKI_DISTRIBUTION_URL = distribution.url;
    process.env.SIGNER_SOCKET_PATH = socketPath;
    process.env.SIGNER_TOKEN_FILE = tokenFile;

    const app = await createApp();
    await app.init();
    const prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });

    return {
      app,
      prisma,
      dir,
      published,
      distribution,
      admin: await bearer(["pki-admin"]),
      operator: await bearer(["pki-operator"]),
      close: async () => {
        await app.close();
        await distribution.stop();
        await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
        await prisma.$disconnect();
        signer.kill("SIGTERM");
        fs.rmSync(dir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    signer.kill("SIGTERM");
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
};

type Offline = { id: string; certificate: string; encryptedKey: string };

export type Hierarchy = {
  /** The offline CAs, with their keys as they left for offline media. */
  root: Offline;
  intermediate: Offline;
  issuing: Record<string, { id: string; certificate: string }>;
};

type IssuerBody = { issuer: { id: string; certificate: string } };

/**
 * Root, one intermediate and the issuing CAs, through the API the way a
 * ceremony builds them: the offline keys leave encrypted and come back in.
 */
export const buildHierarchy = async (
  harness: Harness,
  purposes: { purpose: string; extendedKeyUsages: string[] }[],
): Promise<Hierarchy> => {
  const server = harness.app.getHttpServer();
  const auth = { Authorization: harness.admin };

  const root = await request(server)
    .post("/v1/issuers/roots")
    .set(auth)
    .send({ number: 1, generation: 1, exportPassphrase: EXPORT_PASSPHRASE })
    .expect(201);
  const rootBody = root.body as IssuerBody & { encryptedKey: string };

  const ceremony = async (issuerId: string, privateKey: string) =>
    (
      (
        await request(server)
          .post("/v1/ceremonies")
          .set(auth)
          .send({ issuerId, privateKey, passphrase: EXPORT_PASSPHRASE })
          .expect(201)
      ).body as { ceremony: { id: string } }
    ).ceremony.id;

  const atRoot = await ceremony(rootBody.issuer.id, rootBody.encryptedKey);
  const intermediate = await request(server)
    .post(`/v1/ceremony/${atRoot}/intermediates`)
    .set(auth)
    .send({ number: 1, generation: 1, exportPassphrase: EXPORT_PASSPHRASE })
    .expect(201);
  await request(server).delete(`/v1/ceremony/${atRoot}`).set(auth).expect(204);
  const intermediateBody = intermediate.body as IssuerBody & {
    encryptedKey: string;
  };

  const atIntermediate = await ceremony(
    intermediateBody.issuer.id,
    intermediateBody.encryptedKey,
  );
  const issuing: Hierarchy["issuing"] = {};
  for (const { purpose, extendedKeyUsages } of purposes) {
    const created = await request(server)
      .post(`/v1/ceremony/${atIntermediate}/issuing`)
      .set(auth)
      .send({
        purpose,
        number: 1,
        generation: 1,
        maxValidityDays: 825,
        extendedKeyUsages,
      })
      .expect(201);
    issuing[purpose] = (created.body as IssuerBody).issuer;
  }
  await request(server)
    .delete(`/v1/ceremony/${atIntermediate}`)
    .set(auth)
    .expect(204);

  return {
    root: { ...rootBody.issuer, encryptedKey: rootBody.encryptedKey },
    intermediate: {
      ...intermediateBody.issuer,
      encryptedKey: intermediateBody.encryptedKey,
    },
    issuing,
  };
};

/** A P-256 key pair and a CSR for it. */
export const makeCsr = async (
  commonName: string,
  dns: string[] = [],
  keys?: CryptoKeyPair,
): Promise<{ csr: string; keys: CryptoKeyPair }> => {
  const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const pair =
    keys ??
    ((await webcrypto.subtle.generateKey(algorithm, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair);
  const csr = await x509.Pkcs10CertificateRequestGenerator.create({
    name: `CN=${commonName}`,
    keys: pair,
    signingAlgorithm: algorithm,
    extensions: dns.length
      ? [
          new x509.SubjectAlternativeNameExtension(
            dns.map((value) => ({ type: "dns" as const, value })),
          ),
        ]
      : [],
  });
  return { csr: csr.toString("pem"), keys: pair };
};

/** `openssl verify` of a leaf against the root, through its chain. */
export const opensslVerify = (
  dir: string,
  root: string,
  chain: string[],
  leaf: string,
  purpose?: string,
): string => {
  const write = (name: string, content: string) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, content);
    return file;
  };
  const args = [
    "verify",
    "-CAfile",
    write("root.pem", root),
    "-untrusted",
    write("chain.pem", chain.join("")),
    ...(purpose ? ["-purpose", purpose] : []),
    write("leaf.pem", leaf),
  ];
  return execFileSync("openssl", args, { encoding: "utf8" });
};
