import { Module } from "@nestjs/common";
import { KeywordService } from "./services/KeywordService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateKeywordController } from "./controllers/CreateKeywordController";
import { ListKeywordsController } from "./controllers/ListKeywordsController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [KeywordService],
  controllers: [CreateKeywordController, ListKeywordsController],
})
export class KeywordsModule {}
