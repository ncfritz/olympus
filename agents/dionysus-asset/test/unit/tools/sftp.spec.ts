import { afterEach, describe, expect, it, vi } from "vitest";
import { withSftp } from "../../../src/tools/sftp";
import { FakeSftp } from "../../fixtures/sftp";

vi.mock("ssh2-sftp-client", async () => ({
  default: (await import("../../fixtures/sftp")).FakeSftp,
}));

describe("withSftp", () => {
  afterEach(() => FakeSftp.reset());

  const connection = { host: "cdn", port: 22 };

  it("closes the connection after the work", async () => {
    expect(await withSftp(connection, async () => 42)).toBe(42);
    expect(FakeSftp.instances[0].ended).toBe(true);
  });

  it("closes the connection when the work fails", async () => {
    await expect(
      withSftp(connection, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(FakeSftp.instances[0].ended).toBe(true);
  });

  it("closes the connection when connecting fails", async () => {
    FakeSftp.failConnect = true;
    await expect(withSftp(connection, async () => 1)).rejects.toThrow(
      "connection refused",
    );
    expect(FakeSftp.instances[0].end).toHaveBeenCalled();
  });
});
