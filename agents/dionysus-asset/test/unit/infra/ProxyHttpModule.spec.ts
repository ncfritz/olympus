import { SocksProxyAgent } from "socks-proxy-agent";
import { describe, expect, it } from "vitest";
import type { ProxyConfigType } from "../../../src/config/configuration";
import { proxyHttpOptions } from "../../../src/infra/ProxyHttpModule";

const proxy = (overrides: Partial<ProxyConfigType>): ProxyConfigType => ({
  host: "",
  port: "1080",
  username: "",
  password: "",
  ...overrides,
});

describe("proxyHttpOptions", () => {
  it("goes direct without a proxy host", () => {
    expect(proxyHttpOptions(proxy({}))).toEqual({});
  });

  it("goes through the SOCKS proxy when one is set", () => {
    const options = proxyHttpOptions(
      proxy({ host: "vpn", username: "user", password: "p@ss:word" }),
    );

    expect(options.httpsAgent).toBeInstanceOf(SocksProxyAgent);
    expect(options.httpAgent).toBe(options.httpsAgent);
    const { proxy: target } = options.httpsAgent as SocksProxyAgent;
    expect(target).toMatchObject({
      host: "vpn",
      port: 1080,
      userId: "user",
      password: "p@ss:word",
    });
  });

  it("connects without credentials when there is no username", () => {
    const { httpsAgent } = proxyHttpOptions(proxy({ host: "vpn" }));
    expect((httpsAgent as SocksProxyAgent).proxy.userId).toBeUndefined();
  });
});
