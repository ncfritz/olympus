import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { AddContentAssetTagToAssetController } from "./controllers/AddContentAssetTagToAssetController";
import { CreateContentAssetTagController } from "./controllers/CreateContentAssetTagController";
import { DeleteContentAssetTagFromAssetController } from "./controllers/DeleteContentAssetTagFromAssetController";
import { ListAvailableContentAssetTagsController } from "./controllers/ListAvailableContentAssetTagsController";
import { ListContentAssetTagsForAssetController } from "./controllers/ListContentAssetTagsForAssetController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  controllers: [
    AddContentAssetTagToAssetController,
    CreateContentAssetTagController,
    DeleteContentAssetTagFromAssetController,
    ListAvailableContentAssetTagsController,
    ListContentAssetTagsForAssetController,
  ],
})
export class ContentTagsModule {}
