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

export type TestApp = {
  app: INestApplication;
  http: () => ReturnType<typeof request>;
  graphql: GraphQLMock;
  amqp: AmqpMock;
  /** Clears registered GraphQL responses and recorded calls. */
  reset: () => void;
};

export async function createTestApp(): Promise<TestApp> {
  const graphql = new GraphQLMock();
  const amqp: AmqpMock = { publish: vi.fn().mockResolvedValue(true) };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GraphQLClient)
    .useValue(graphql)
    .overrideProvider(AmqpConnection)
    .useValue(amqp)
    .compile();

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
  };
}
