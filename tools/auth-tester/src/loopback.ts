import * as http from "http";
import { TesterError } from "./errors";

export type LoopbackListener = {
  /** The exact URI to register as `redirect_uri`. */
  redirectUri: string;
  /** The query the browser arrived with, once it has. */
  waitForRedirect(timeoutMs?: number): Promise<URLSearchParams>;
  close(): void;
};

const PAGE = (message: string): string =>
  `<!doctype html><meta charset="utf-8"><title>Olympus auth tester</title>` +
  `<p style="font:16px system-ui;margin:3rem">${message}</p>`;

/**
 * Catches the redirect that carries the authorization code (RFC 8252 §7.3).
 *
 * Bound to `127.0.0.1` and not to every interface: the code arrives in a
 * query string, and a listener on `0.0.0.0` would accept it from the
 * network. The port is whatever the operating system gives, because a native
 * client cannot reserve one -- which is exactly why the API accepts any port
 * on loopback for this client and an exact URI everywhere else.
 */
export const listenForRedirect = async (
  path: string,
  port = 0,
): Promise<LoopbackListener> => {
  let arrived: ((params: URLSearchParams) => void) | undefined;
  const redirect = new Promise<URLSearchParams>((resolve) => {
    arrived = resolve;
  });

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== path) {
      // A browser asking for /favicon.ico is not the sign-in coming back.
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(PAGE("Signed in. Back to the terminal."));
    arrived?.(url.searchParams);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new TesterError("could not listen on 127.0.0.1 for the redirect");
  }

  return {
    redirectUri: `http://127.0.0.1:${address.port}${path}`,
    waitForRedirect: (timeoutMs = 300_000) =>
      Promise.race([
        redirect,
        new Promise<never>((_resolve, reject) => {
          const timer = setTimeout(() => {
            reject(
              new TesterError(
                `nothing came back to ${path} in ${
                  timeoutMs >= 1000
                    ? `${Math.round(timeoutMs / 1000)}s`
                    : `${timeoutMs}ms`
                }`,
              ),
            );
          }, timeoutMs);
          // Nothing else keeps the process alive once the redirect lands, so
          // the timer must not be what holds it open.
          timer.unref();
        }),
      ]),
    close: () => server.close(),
  };
};
