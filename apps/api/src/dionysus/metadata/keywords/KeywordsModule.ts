import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateKeywordController } from "./controllers/CreateKeywordController";
import { ListKeywordsController } from "./controllers/ListKeywordsController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [CreateKeywordController, ListKeywordsController],
})
export class KeywordsModule {}
