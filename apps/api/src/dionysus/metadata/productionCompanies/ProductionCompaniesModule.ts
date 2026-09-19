import { Module } from "@nestjs/common";
import { ProductionCompanyService } from "./services/ProductionCompanyService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateProductionCompanyController } from "./controllers/CreateProductionCompanyController";
import { DescribeProductionCompanyController } from "./controllers/DescribeProductionCompanyController";
import { ListProductionCompaniesController } from "./controllers/ListProductionCompaniesController";
import { ListProductionCompanyMoviesController } from "./controllers/ListProductionCompanyMoviesController";
import { ListProductionCompanyTvSeriesController } from "./controllers/ListProductionCompanyTvSeriesController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [ProductionCompanyService],
  controllers: [
    CreateProductionCompanyController,
    DescribeProductionCompanyController,
    ListProductionCompaniesController,
    ListProductionCompanyMoviesController,
    ListProductionCompanyTvSeriesController,
  ],
})
export class ProductionCompaniesModule {}
