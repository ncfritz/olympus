import { HttpModule, type HttpModuleOptions } from "@nestjs/axios";
import { Logger, Module } from "@nestjs/common";
import { SocksProxyAgent } from "socks-proxy-agent";
import { proxyConfig } from "../config/configuration";
import type { ProxyConfigType } from "../config/configuration";

const logger = new Logger("ProxyHttpModule");

/**
 * HttpService options for the content page requests: through the SOCKS
 * proxy when SOCKS_PROXY_HOST is set, direct otherwise.
 */
export const proxyHttpOptions = (proxy: ProxyConfigType): HttpModuleOptions => {
  if (!proxy.host) {
    logger.warn("SOCKS_PROXY_HOST is not set: content requests go direct");
    return {};
  }

  const proxyUrl = `socks5h://${proxy.host}:${proxy.port}`;
  const credentials = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
    : "";

  logger.log(`Using the proxy ${proxyUrl}`);

  const agent = new SocksProxyAgent(
    `socks5h://${credentials}${proxy.host}:${proxy.port}`,
    { timeout: 60000 },
  );

  return { httpsAgent: agent, httpAgent: agent };
};

/** HttpService for the content page requests (see proxyHttpOptions). */
@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [proxyConfig.KEY],
      useFactory: proxyHttpOptions,
    }),
  ],
  exports: [HttpModule],
})
export class ProxyHttpModule {}
