import { GraphQLRequestModule } from "@golevelup/nestjs-graphql-request";
import { Module } from "@nestjs/common";
import configuration from "../utils/configuration";

@Module({
  imports: [
    GraphQLRequestModule.forRoot(GraphQLRequestModule, {
      endpoint: `${configuration().hasura.protocol}://${configuration().hasura.host}:${configuration().hasura.port}/v1/graphql`,
      options: {
        headers: {
          "content-type": "application/json",
          "x-hasura-admin-secret": configuration().hasura.password,
        },
      },
    }),
  ],
  exports: [GraphQLRequestModule],
  providers: [],
  controllers: [],
})
export class GraphQLClientModule {
  constructor() {
    console.log(configuration());
  }
}
