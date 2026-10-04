import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { GoogleCredentialStore } from "../../../../src/providers/google/GoogleCredentialStore";

const store = () =>
  new GoogleCredentialStore({
    clientId: "desktop-client",
    clientSecret: "desktop-secret",
    webClientId: "web-client",
    webClientSecret: "web-secret",
    credentialsDir: mkdtempSync(join(tmpdir(), "google-credentials-")),
  });

const credential = {
  accountLabel: "me@example.com",
  refreshToken: "refresh",
  scope: "scope",
  obtainedAt: "2026-10-03T00:00:00.000Z",
};

describe("GoogleCredentialStore", () => {
  it("redeems a credential with the client that issued it", () => {
    const credentials = store();
    credentials.save(credential);
    expect(credentials.createAuthorizedClient("me@example.com")._clientId).toBe(
      "desktop-client",
    );

    credentials.save({ ...credential, client: "web" });
    expect(credentials.createAuthorizedClient("me@example.com")._clientId).toBe(
      "web-client",
    );
  });

  it("removes a credential, and removing none is nothing", () => {
    const credentials = store();
    credentials.save(credential);

    credentials.remove("me@example.com");
    credentials.remove("me@example.com");

    expect(credentials.tryLoad("me@example.com")).toBeUndefined();
  });
});
