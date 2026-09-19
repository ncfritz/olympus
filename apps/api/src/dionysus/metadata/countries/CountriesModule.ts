import { Module } from "@nestjs/common";
import { CountryService } from "./services/CountryService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateCountryController } from "./controllers/CreateCountryController";
import { ListCountriesController } from "./controllers/ListCountriesController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [CountryService],
  controllers: [CreateCountryController, ListCountriesController],
})
export class CountriesModule {}
