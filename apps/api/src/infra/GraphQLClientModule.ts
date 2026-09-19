import { Logger, Module } from "@nestjs/common";
import { GraphQLClient } from "graphql-request";
import { hasuraConfig, HasuraConfigType } from "../config/configuration";

/** The Hasura GraphQL client (the API is Hasura's only client). */
@Module({
  exports: [GraphQLClient],
  providers: [
    {
      provide: GraphQLClient,
      inject: [hasuraConfig.KEY],
      useFactory: (hasura: HasuraConfigType): GraphQLClient => {
        new Logger(GraphQLClientModule.name).log(
          `Using Hasura at ${hasura.endpoint}`,
        );
        return new GraphQLClient(hasura.endpoint, {
          headers: {
            "content-type": "application/json",
            "x-hasura-admin-secret": hasura.adminSecret,
          },
        });
      },
    },
  ],
})
export class GraphQLClientModule {}
