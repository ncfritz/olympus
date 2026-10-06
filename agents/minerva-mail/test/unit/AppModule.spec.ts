import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Module } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";
import { GmailPoller } from "../../src/gmail/GmailPoller";
import { RabbitModule } from "../../src/infra/RabbitModule";

/** The broker, as the graph sees it: no connection is made in a test. */
@Module({
  providers: [{ provide: AmqpConnection, useValue: { publish: () => true } }],
  exports: [AmqpConnection],
})
class NoBrokerModule {}

/** Resolves the whole dependency graph (compile() does not start the app). */
describe("AppModule", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(RabbitModule)
      .useModule(NoBrokerModule)
      .compile();
  });

  afterAll(async () => moduleRef?.close());

  it("compiles", () => {
    expect(moduleRef).toBeDefined();
  });

  it("polls Gmail only when its client is configured", () => {
    // The test environment configures no Gmail client.
    expect(moduleRef.get(GmailPoller).intervalMs).toBe(0);
  });
});
