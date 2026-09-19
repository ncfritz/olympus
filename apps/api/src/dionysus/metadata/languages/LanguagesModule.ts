import { Module } from "@nestjs/common";
import { LanguageService } from "./services/LanguageService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateLanguageController } from "./controllers/CreateLanguageController";
import { ListLanguagesController } from "./controllers/ListLanguagesController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [LanguageService],
  controllers: [CreateLanguageController, ListLanguagesController],
})
export class LanguagesModule {}
