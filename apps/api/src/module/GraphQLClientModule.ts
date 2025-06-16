import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GraphQLClient } from "graphql-request";

@Module({
  imports: [],
  exports: [GraphQLClientModule, GraphQLClient],
  providers: [
    {
      provide: GraphQLClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService): GraphQLClient => {
        const hasuraProtocol = config.get<string>("HASURA_PROTOCOL", "http");
        const hasuraHost = config.get<string>("HASURA_HOST", "localhost");
        const hasuraPort = parseInt(config.get<string>("HASURA_PORT", "8080"));
        const hasuraPassword = config.get<string>("HASURA_PASSWORD", "");

        const hasuraEndpoint = `${hasuraProtocol}://${hasuraHost}:${hasuraPort}/v1/graphql`;

        console.info(`Starting GraphQLClientModule - ${hasuraEndpoint}`);

        return new GraphQLClient(hasuraEndpoint, {
          headers: {
            "content-type": "application/json",
            "x-hasura-admin-secret": hasuraPassword,
          },
        });
      },
    },
  ],
  controllers: [],
})
export class GraphQLClientModule {}
