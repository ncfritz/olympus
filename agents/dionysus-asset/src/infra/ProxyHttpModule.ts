import { HttpModule } from "@nestjs/axios";
import { Logger, Module } from "@nestjs/common";
import { SocksProxyAgent } from "socks-proxy-agent";
import { proxyConfig } from "../config/configuration";
import type { ProxyConfigType } from "../config/configuration";

/** HttpService through the SOCKS proxy (content page requests). */
@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [proxyConfig.KEY],
      useFactory: (proxy: ProxyConfigType) => {
        const proxyUrl = `socks5h://${proxy.host}:${proxy.port}`;
        const authenticatedProxyUrl = `socks5h://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;

        new Logger(ProxyHttpModule.name).log(`Using the proxy ${proxyUrl}`);

        const agent = new SocksProxyAgent(authenticatedProxyUrl, {
          timeout: 60000,
        });

        return {
          httpsAgent: agent,
          httpAgent: agent,
        };
      },
    }),
  ],
  exports: [HttpModule],
})
export class ProxyHttpModule {}
