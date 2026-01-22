import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SocksProxyAgent } from "socks-proxy-agent";
import { logger } from "../util/logger";

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const socksProxyHost = config.get<string>("SOCKS_PROXY_HOST", "");
        const socksProxyPort = config.get<string>("SOCKS_PROXY_PORT", "1080");
        const socksPRoxyUsername = config.get<string>(
          "SOCKS_PROXY_USERNAME",
          "",
        );
        const socksPRoxyPassword = config.get<string>(
          "SOCKS_PROXY_PASSWORD",
          "",
        );

        const socksPRoxyUrl = `socks5h://${socksProxyHost}:${socksProxyPort}`;
        const authenticatedSocksPRoxyUrl = `socks5h://${socksPRoxyUsername}:${socksPRoxyPassword}@${socksProxyHost}:${socksProxyPort}`;

        logger.info(`Starting AxiosProxyModule - ${socksPRoxyUrl}`);

        const agent = new SocksProxyAgent(authenticatedSocksPRoxyUrl, {
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
  providers: [],
  controllers: [],
})
export class AxiosProxyModule {}
