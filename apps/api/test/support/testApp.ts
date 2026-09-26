/**
 * Boots the real AppModule for HTTP-level tests, with Hasura and RabbitMQ
 * replaced by in-memory doubles. Requests go through the same middleware,
 * versioning, routing and interceptors as production (configureApp).
 */
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { GraphQLClient } from "graphql-request";
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

  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(options.env ?? {})) {
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

  return {
    app,
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
    },
  };
}
