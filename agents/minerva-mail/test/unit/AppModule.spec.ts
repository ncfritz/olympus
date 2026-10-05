import { Test, TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";

/** Resolves the whole dependency graph (compile() does not start the app). */
describe("AppModule", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => moduleRef.close());

  it("compiles", () => {
    expect(moduleRef).toBeDefined();
  });
});
