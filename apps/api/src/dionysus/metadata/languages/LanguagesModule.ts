import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateLanguageController } from "./controllers/CreateLanguageController";
import { ListLanguagesController } from "./controllers/ListLanguagesController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [CreateLanguageController, ListLanguagesController],
})
export class LanguagesModule {}
