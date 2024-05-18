import { GraphQLRequestModule } from "@golevelup/nestjs-graphql-request";
import { Module } from "@nestjs/common";

const HASURA_PROTOCOL = process.env.HASURA_PROTOCOL || "http";
const HASURA_HOST = process.env.HASURA_HOST || "localhost";
const HASURA_PORT = process.env.HASURA_PORT || 8080;
const HASURA_PASSWORD = process.env.HASURA_PASSWORD || "admin";

@Module({
  imports: [
    GraphQLRequestModule.forRoot(GraphQLRequestModule, {
      endpoint: `${HASURA_PROTOCOL}://${HASURA_HOST}:${HASURA_PORT}/v1/graphql`,
      options: {
        headers: {
          "content-type": "application/json",
          "x-hasura-admin-secret": HASURA_PASSWORD,
        },
      },
    }),
  ],
  exports: [GraphQLRequestModule],
  providers: [],
  controllers: [],
})
export class GraphQLClientModule {}
