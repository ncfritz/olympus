import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateCollectionController } from "./controllers/CreateCollectionController";
import { DescribeCollectionController } from "./controllers/DescribeCollectionController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [CreateCollectionController, DescribeCollectionController],
})
export class CollectionsModule {}
