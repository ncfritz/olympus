import { vi } from "vitest";

/**
 * A stand-in for ssh2-sftp-client: `vi.mock("ssh2-sftp-client", () =>
 * ({ default: FakeSftp }))`. Each instance is recorded; set `failPut` or
 * `failConnect` to make the next ones fail.
 */
export class FakeSftp {
  static instances: FakeSftp[] = [];
  static failPut = false;
  static failConnect = false;

  connected = false;
  ended = false;
  puts: string[] = [];

  constructor() {
    FakeSftp.instances.push(this);
  }

  static reset() {
    FakeSftp.instances = [];
    FakeSftp.failPut = false;
    FakeSftp.failConnect = false;
  }

  connect = vi.fn(async () => {
    if (FakeSftp.failConnect) throw new Error("connection refused");
    this.connected = true;
  });

  mkdir = vi.fn(async () => "ok");

  put = vi.fn(async (stream: NodeJS.ReadableStream, remote: string) => {
    // Read it all, as the real upload would, before the test cleans up.
    await new Promise<void>((resolve, reject) => {
      stream.on("end", () => resolve());
      stream.on("error", reject);
      stream.resume();
    });
    if (FakeSftp.failPut) throw new Error("disk full");
    this.puts.push(remote);
    return "ok";
  });

  end = vi.fn(async () => {
    this.ended = true;
    return true;
  });
}
