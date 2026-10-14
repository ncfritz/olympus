import type { INestApplication } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as tls from "tls";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createClientCertificateListener,
  readRevocationList,
  refusalMessage,
} from "../../../src/mtls/clientCertificateListener";

/** The repository's dev CA (`scripts/dev-ca.sh`): the suites below skip without it. */
const DEV_CA = path.resolve(__dirname, "../../../../../infra/dev-ca/certs");

/**
 * A revocation list from a throwaway CA, made with openssl in a temporary
 * directory: the test needs no dev CA (`scripts/dev-ca.sh`) to have run.
 */
const makeRevocationList = (dir: string): string => {
  const at = (name: string) => path.join(dir, name);
  fs.writeFileSync(at("index.txt"), "");
  fs.writeFileSync(at("crlnumber"), "01\n");
  fs.writeFileSync(
    at("ca.cnf"),
    [
      "[ca]",
      "default_ca = test",
      "[test]",
      `database = ${at("index.txt")}`,
      `crlnumber = ${at("crlnumber")}`,
      "default_md = sha256",
      "default_crl_days = 1",
      "",
    ].join("\n"),
  );
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      at("ca.key"),
      "-out",
      at("ca.crt"),
      "-subj",
      "/CN=readRevocationList test CA",
      "-days",
      "1",
    ],
    { stdio: "ignore" },
  );
  execFileSync(
    "openssl",
    [
      "ca",
      "-gencrl",
      "-config",
      at("ca.cnf"),
      "-keyfile",
      at("ca.key"),
      "-cert",
      at("ca.crt"),
      "-out",
      at("list.crl"),
    ],
    { stdio: "ignore" },
  );
  return at("list.crl");
};

describe("readRevocationList", () => {
  let dir: string;
  let list: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "nest-crl-"));
    list = makeRevocationList(dir);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns a PEM list as it is", () => {
    expect(readRevocationList(list)).toEqual(fs.readFileSync(list));
  });

  it("turns a DER list, as Harpocrates publishes, into the same PEM", () => {
    const der = path.join(dir, "list.der");
    execFileSync("openssl", [
      "crl",
      "-in",
      list,
      "-outform",
      "DER",
      "-out",
      der,
    ]);
    const pem = readRevocationList(der).toString("latin1");
    expect(pem).toMatch(/^-----BEGIN X509 CRL-----\n/);
    expect(pem.replace(/\s/g, "")).toBe(
      fs.readFileSync(list, "latin1").replace(/\s/g, ""),
    );
  });
});

describe("refusalMessage", () => {
  it("names the caller's address", () => {
    expect(
      refusalMessage(
        new Error("peer did not return a certificate"),
        "10.210.3.7:51234",
      ),
    ).toBe(
      "Refused a connection from 10.210.3.7:51234: peer did not return a certificate",
    );
  });

  it.each([
    "ssl/tls alert certificate unknown",
    "tlsv1 alert unknown ca",
    "ssl/tls alert bad certificate",
  ])(
    "says when the caller refused this listener's certificate (%s)",
    (alert) => {
      expect(
        refusalMessage(new Error(`ssl3_read_bytes:${alert}`), undefined),
      ).toMatch(
        /^Refused a connection from an unknown address: .*the caller refused this listener's certificate/,
      );
    },
  );

  it("does not blame the listener for the caller's own certificate", () => {
    expect(
      refusalMessage(new Error("certificate verify failed"), "127.0.0.1:1"),
    ).not.toMatch(/caller refused/);
  });
});

describe.skipIf(!fs.existsSync(path.join(DEV_CA, "agents/olympus-api.crt")))(
  "a refused handshake",
  () => {
    let server: ReturnType<typeof createClientCertificateListener> | undefined;
    afterEach(() => {
      server?.close();
      vi.restoreAllMocks();
    });

    it("is logged with the caller's address, which the torn-down socket no longer has", async () => {
      const warn = vi
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);
      vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      const app = {
        getHttpAdapter: () => ({ getInstance: () => () => undefined }),
      } as unknown as INestApplication;
      server = createClientCertificateListener(
        app,
        {
          port: 0,
          certificate: path.join(DEV_CA, "api.crt"),
          key: path.join(DEV_CA, "api.key"),
          ca: path.join(DEV_CA, "services-ca.crt"),
          revocationLists: [],
        },
        { name: "ServicesListener" },
      );
      await new Promise((resolve) => server!.once("listening", resolve));
      const { port } = server.address() as { port: number };

      // A caller that does not trust the listener's certificate hangs up
      // mid-handshake; by the time that is reported, the TLS socket has
      // no address left.
      const refused = new Promise((resolve) =>
        server!.once("tlsClientError", resolve),
      );
      const client = tls.connect({
        port,
        host: "127.0.0.1",
        servername: "localhost",
        // Trusting only the listener's own certificate and no root: Node
        // does not accept a chain that ends short of one.
        ca: fs.readFileSync(path.join(DEV_CA, "api.crt")),
        cert: fs.readFileSync(path.join(DEV_CA, "agents/olympus-api.crt")),
        key: fs.readFileSync(path.join(DEV_CA, "agents/olympus-api.key")),
      });
      client.on("error", () => undefined);
      await refused;
      client.destroy();

      const lines = warn.mock.calls.map(([m]) => String(m));
      expect(
        lines.some((m) =>
          /^Refused a connection from 127\.0\.0\.1:\d+: /.test(m),
        ),
      ).toBe(true);
    });
  },
);

describe.skipIf(!fs.existsSync(path.join(DEV_CA, "api.crt")))(
  "a renewed certificate",
  () => {
    let server: ReturnType<typeof createClientCertificateListener> | undefined;
    afterEach(() => {
      server?.close();
      vi.restoreAllMocks();
    });

    /** What the listener presents to a new connection. */
    const served = (port: number): Promise<string> =>
      new Promise((resolve, reject) => {
        const client = tls.connect(
          {
            port,
            host: "127.0.0.1",
            rejectUnauthorized: false,
            cert: fs.readFileSync(path.join(DEV_CA, "agents/olympus-api.crt")),
            key: fs.readFileSync(path.join(DEV_CA, "agents/olympus-api.key")),
          },
          () => {
            resolve(client.getPeerCertificate().fingerprint256);
            client.destroy();
          },
        );
        client.on("error", reject);
      });

    it("is served to new connections without a restart", async () => {
      vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "listener-"));
      const certificate = path.join(dir, "server.crt");
      const key = path.join(dir, "server.key");
      const install = (name: string) => {
        fs.copyFileSync(path.join(DEV_CA, `${name}.crt`), certificate);
        fs.copyFileSync(path.join(DEV_CA, `${name}.key`), key);
      };
      install("api");
      const app = {
        getHttpAdapter: () => ({ getInstance: () => () => undefined }),
      } as unknown as INestApplication;
      server = createClientCertificateListener(
        app,
        {
          port: 0,
          certificate,
          key,
          ca: path.join(DEV_CA, "services-ca.crt"),
          revocationLists: [],
        },
        { name: "ServicesListener", pollMs: 20 },
      );
      await new Promise((resolve) => server!.once("listening", resolve));
      const { port } = server.address() as { port: number };
      const before = await served(port);

      install("agents/olympus-api");
      await vi.waitFor(
        async () => expect(await served(port)).not.toBe(before),
        {
          timeout: 5_000,
          interval: 50,
        },
      );
      fs.rmSync(dir, { recursive: true, force: true });
    });
  },
);
