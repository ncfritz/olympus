import { Module } from "@nestjs/common";
import { CollectionService } from "./services/CollectionService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateCollectionController } from "./controllers/CreateCollectionController";
import { DescribeCollectionController } from "./controllers/DescribeCollectionController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [CollectionService],
  controllers: [CreateCollectionController, DescribeCollectionController],
})
export class CollectionsModule {}
