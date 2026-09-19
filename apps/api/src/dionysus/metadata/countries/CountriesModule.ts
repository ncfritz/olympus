import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateCountryController } from "./controllers/CreateCountryController";
import { ListCountriesController } from "./controllers/ListCountriesController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [CreateCountryController, ListCountriesController],
})
export class CountriesModule {}
