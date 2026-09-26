/**
 * Boots the real AppModule for HTTP-level tests, with Hasura and RabbitMQ
 * replaced by in-memory doubles. Requests go through the same middleware,
 * versioning, routing and interceptors as production (configureApp).
 */
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as fs from "fs";
import { GraphQLClient } from "graphql-request";
import * as os from "os";
import * as path from "path";
import request from "supertest";
import { vi } from "vitest";
import { configureApp } from "../../src/configureApp";
import { AppModule } from "../../src/AppModule";
import { GraphQLMock } from "./graphqlMock";

// Never connect to a broker.
AmqpConnection.prototype.init = async () => {};
AmqpConnection.prototype.close = async () => {};

export type AmqpMock = { publish: ReturnType<typeof vi.fn> };

export type TestAppOptions = {
  /**
   * Settings this app reads, applied before the module compiles and put
   * back by `close()`.
   *
   * The configuration namespaces call `readConfig(process.env)` while the
   * module is being built, so a spec that needs a setting has to have it in
   * place by then — which is why specs used to assign `process.env`
   * directly and delete it afterwards. Doing it here means one place
   * remembers to undo it, and a spec that throws cannot leak a setting into
   * whatever runs next.
   */
  env?: Record<string, string | undefined>;
  /** Providers to replace, for a dependency a test drives itself. */
  overrides?: { provide: unknown; useValue: unknown }[];
};

export type TestApp = {
  app: INestApplication;
  /** Where this app writes uploads, and where agents would read them. */
  paths: { upload: string; publish: string };
  http: () => ReturnType<typeof request>;
  graphql: GraphQLMock;
  amqp: AmqpMock;
  /** Clears registered GraphQL responses and recorded calls. */
  reset: () => void;
  /** Closes the app and restores whatever `env` changed. */
  close: () => Promise<void>;
};

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestApp> {
  const graphql = new GraphQLMock();
  const amqp: AmqpMock = { publish: vi.fn().mockResolvedValue(true) };

  // Its own directories, not one path shared by every file. Test files run
  // in parallel processes, so a single DIONYSUS_UPLOAD_PATH is a directory
  // one file can delete while another is still writing to it.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "olympus-api-test-"));
  const paths = {
    upload: path.join(scratch, "upload"),
    publish: path.join(scratch, "publish"),
  };
  fs.mkdirSync(paths.upload, { recursive: true });
  fs.mkdirSync(paths.publish, { recursive: true });

  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries({
    DIONYSUS_UPLOAD_PATH: paths.upload,
    DIONYSUS_PUBLISH_PATH: paths.publish,
    ...options.env,
  })) {
    previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  const restore = () => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };

  let moduleRef;
  try {
    let builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GraphQLClient)
      .useValue(graphql)
      .overrideProvider(AmqpConnection)
      .useValue(amqp);
    for (const override of options.overrides ?? []) {
      builder = builder
        .overrideProvider(override.provide)
        .useValue(override.useValue);
    }
    moduleRef = await builder.compile();
  } catch (error: unknown) {
    // A module that fails to build would otherwise leave the settings
    // behind, and the next file in this worker would inherit them.
    restore();
    throw error;
  }

  // TEST_NEST_LOGS=1 shows Nest's error log (e.g. the stack behind a 500).
  const app = configureApp(
    moduleRef.createNestApplication({
      logger: process.env.TEST_NEST_LOGS ? ["error"] : false,
    }),
  );
  await app.init();

  // Listening once, rather than letting supertest bind and unbind a port for
  // every request: one app, one port for its lifetime. Several hundred
  // bind/close cycles across parallel processes is churn with nothing to
  // recommend it.
  await app.listen(0);

  return {
    app,
    paths,
    http: () => request(app.getHttpServer()),
    graphql,
    amqp,
    reset: () => {
      graphql.reset();
      amqp.publish.mockClear();
    },
    close: async () => {
      await app.close();
      restore();
      fs.rmSync(scratch, { recursive: true, force: true });
    },
  };
}
