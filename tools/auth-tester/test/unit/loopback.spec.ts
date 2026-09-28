import * as http from "http";
import { describe, expect, it } from "vitest";
import { listenForRedirect } from "../../src/loopback";

const get = (url: string): Promise<number> =>
  new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      })
      .on("error", reject);
  });

describe("listenForRedirect", () => {
  it("answers on loopback at a port it was given", async () => {
    const listener = await listenForRedirect("/callback");
    try {
      // The shape the API registered for this client: loopback, that path,
      // and no query of its own.
      expect(listener.redirectUri).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/callback$/,
      );

      const waiting = listener.waitForRedirect(5_000);
      expect(
        await get(`${listener.redirectUri}?code=a-code&state=a-state`),
      ).toBe(200);

      const params = await waiting;
      expect(params.get("code")).toBe("a-code");
      expect(params.get("state")).toBe("a-state");
    } finally {
      listener.close();
    }
  });

  /** A browser asking for a favicon is not the sign-in coming back. */
  it("ignores every other path", async () => {
    const listener = await listenForRedirect("/callback");
    try {
      const url = new URL(listener.redirectUri);
      expect(await get(`${url.origin}/favicon.ico`)).toBe(404);

      const raced = await Promise.race([
        listener.waitForRedirect(150).catch(() => "timed out"),
        new Promise((resolve) =>
          setTimeout(() => resolve("still waiting"), 500),
        ),
      ]);
      expect(raced).toBe("timed out");
    } finally {
      listener.close();
    }
  });

  it("gives up with a sentence rather than waiting forever", async () => {
    const listener = await listenForRedirect("/callback");
    try {
      await expect(listener.waitForRedirect(50)).rejects.toThrow(
        /nothing came back to \/callback in 50ms/,
      );
    } finally {
      listener.close();
    }
  });
});
