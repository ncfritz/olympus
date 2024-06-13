import {
  GraphQLRequestModule,
  GraphQLRequestModuleConfig,
} from "@golevelup/nestjs-graphql-request";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Module({
  imports: [
    GraphQLRequestModule.forRootAsync(GraphQLRequestModule, {
      inject: [ConfigService],
      useFactory: (config: ConfigService): GraphQLRequestModuleConfig => {
        const hasuraProtocol = config.get<string>("HASURA_PROTOCOL", "http");
        const hasuraHost = config.get<string>("HASURA_HOST", "localhost");
        const hasuraPort = parseInt(config.get<string>("HASURA_PORT", "8080"));
        const hasuraPassword = config.get<string>("HASURA_PASSWORD", "");

        return {
          endpoint: `${hasuraProtocol}://${hasuraHost}:${hasuraPort}/v1/graphql`,
          options: {
            headers: {
              "content-type": "application/json",
              "x-hasura-admin-secret": hasuraPassword,
            },
          },
        };
      },
    }),
  ],
  exports: [GraphQLRequestModule],
  providers: [],
  controllers: [],
})
export class GraphQLClientModule {}
