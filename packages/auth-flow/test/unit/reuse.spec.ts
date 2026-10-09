import { describe, expect, it, vi } from "vitest";
import type { FormAnswer, FormPost } from "../../src/oauth";
import { checkReuseDetection } from "../../src/reuse";

// Typed as a `FormPost`, which is what makes `post.mock.calls[n][1]` the form
// this asserts on: a `vi.fn` over a zero-argument function has an empty tuple
// for its calls, and indexing it does not compile.
const answering = (...answers: Partial<FormAnswer>[]) => {
  const queue = [...answers];
  const post: FormPost = async () => {
    const next = queue.shift() ?? { status: 500 };
    return { status: 200, body: {}, headers: {}, ...next };
  };
  return vi.fn(post);
};

const REFUSED = { status: 400, body: { error: "invalid_grant" } };
const ISSUED = {
  status: 200,
  body: {
    access_token: "a",
    token_type: "Bearer",
    expires_in: 600,
    refresh_token: "r",
  },
};

const request = {
  clientId: "olympus-auth-tester",
  previousRefreshToken: "the-rotated-one",
  refreshToken: "the-live-one",
};

describe("checkReuseDetection", () => {
  /** What ADR 0018 promises: refused, and the session gone with it. */
  it("is revoked when the replay and the live token are both refused", async () => {
    const post = answering(REFUSED, REFUSED);
    const result = await checkReuseDetection(post, request);

    expect(result.verdict).toBe("revoked");
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "the-rotated-one",
    });
    expect(post.mock.calls[1]?.[1]).toMatchObject({
      refresh_token: "the-live-one",
    });
  });

  /**
   * The distinction the second request exists for: an API that had merely
   * forgotten the old token would refuse the replay and leave the session
   * alone, and calling that "reuse detection" would be believing a test that
   * cannot fail.
   */
  it("is refused-only when the live token still works", async () => {
    const result = await checkReuseDetection(
      answering(REFUSED, ISSUED),
      request,
    );
    expect(result.verdict).toBe("refused-only");
    expect(result.live.status).toBe(200);
  });

  it("is accepted when the rotated token was honoured, and asks nothing more", async () => {
    const post = answering(ISSUED);
    const result = await checkReuseDetection(post, request);
    expect(result.verdict).toBe("accepted");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("hands back both answers, so a caller can show what came back", async () => {
    const result = await checkReuseDetection(
      answering(REFUSED, REFUSED),
      request,
    );
    expect(result.replayed.status).toBe(400);
    expect(result.live.status).toBe(400);
  });
});
