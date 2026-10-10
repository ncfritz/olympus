import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { ConsoleSessionConfig } from "../../../src/consoleSession/config";
import { ConsoleSignIn } from "../../../src/consoleSession/ConsoleSignIn";
import type { OlympusAuthApi } from "../../../src/consoleSession/OlympusAuthApi";

const CONFIG: ConsoleSessionConfig = {
  clientId: "harpocrates-ca-console",
  deviceName: "Harpocrates CA console",
  cookiePrefix: "harpocrates",
  baseUrl: "https://control.test/harpocrates/ca/api",
  webAppUrl: "https://control.test/harpocrates/ca",
  olympus: { apiUrl: "http://olympus.test", signInUrl: "https://olympus.test" },
};

const TRANSACTION = JSON.stringify({ state: "s", verifier: "v" });

const signInWith = (postForm: OlympusAuthApi["postForm"]) =>
  new ConsoleSignIn({ postForm } as OlympusAuthApi, CONFIG);

describe("ConsoleSignIn.complete", () => {
  it("answers 503 with the reason when the API cannot be reached", async () => {
    const signIn = signInWith(() =>
      Promise.reject(
        new TypeError("fetch failed", {
          cause: Object.assign(new Error("self-signed certificate"), {
            code: "SELF_SIGNED_CERT_IN_CHAIN",
          }),
        }),
      ),
    );
    const completing = signIn.complete(TRANSACTION, { code: "c", state: "s" });
    await expect(completing).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(completing).rejects.toThrow(
      "The Olympus API cannot be reached: SELF_SIGNED_CERT_IN_CHAIN",
    );
  });

  it("still answers 400 when the API refuses the code", async () => {
    const signIn = signInWith(() =>
      Promise.resolve({
        status: 400,
        headers: {},
        body: { error: "invalid_grant" },
      }),
    );
    await expect(
      signIn.complete(TRANSACTION, { code: "c", state: "s" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
