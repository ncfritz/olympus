import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Test, TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";
import { GmailHandler } from "../../src/channels/email/handlers/GmailHandler";
import { SynologyMailHandler } from "../../src/channels/email/handlers/SynologyMailHandler";
import { SynoChatHandler } from "../../src/channels/synochat/handlers/SynoChatHandler";
import { WebSocketHandler } from "../../src/channels/websocket/handlers/WebSocketHandler";

/** The @RabbitSubscribe configuration of a handler's handle(). */
const subscription = (handler: { prototype: object }) => {
  const handle = (handler.prototype as { handle: object }).handle;
  return Reflect.getMetadataKeys(handle)
    .map((key) => Reflect.getMetadata(key, handle))
    .find((value) => value && typeof value === "object" && "queue" in value);
};

// Never connect to a broker.
AmqpConnection.prototype.init = async () => {};
AmqpConnection.prototype.close = async () => {};

/**
 * Resolves the whole dependency graph (compile() does not start the app) and checks each handler's queue.
 */
describe("AppModule", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => moduleRef.close());

  it.each([
    [WebSocketHandler, "notifications.ws", "notifications.type.ws"],
    [SynoChatHandler, "notifications.synochat", "notifications.type.synochat"],
    [
      SynologyMailHandler,
      "notifications.synomail",
      "notifications.type.synomail",
    ],
    [GmailHandler, "notifications.email", "notifications.type.email"],
  ])("wires %o to its queue", (handler, queue, routingKey) => {
    expect(moduleRef.get(handler)).toBeInstanceOf(handler);
    expect(subscription(handler)).toMatchObject({
      exchange: "notifications.trigger",
      queue,
      routingKey,
    });
  });
});
