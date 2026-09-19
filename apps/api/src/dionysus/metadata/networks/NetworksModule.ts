import { Module } from "@nestjs/common";
import { NetworkService } from "./services/NetworkService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateNetworkController } from "./controllers/CreateNetworkController";
import { DescribeNetworkController } from "./controllers/DescribeNetworkController";
import { ListNetworkTvSeriesController } from "./controllers/ListNetworkTvSeriesController";
import { ListNetworksController } from "./controllers/ListNetworksController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [NetworkService],
  controllers: [
    CreateNetworkController,
    DescribeNetworkController,
    ListNetworkTvSeriesController,
    ListNetworksController,
  ],
})
export class NetworksModule {}
