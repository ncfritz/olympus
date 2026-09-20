import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "../../src/AppController";
import { AppService } from "../../src/AppService";
import { beforeEach, describe, expect, it } from "vitest";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe("Hello World!");
    });
  });
});
