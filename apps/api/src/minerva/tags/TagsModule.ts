import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CreateTagController } from "./controllers/CreateTagController";
import { DeleteTagController } from "./controllers/DeleteTagController";
import { DescribeTagController } from "./controllers/DescribeTagController";
import { ListTagsController } from "./controllers/ListTagsController";
import { UpdateTagController } from "./controllers/UpdateTagController";
import { TagService } from "./services/TagService";

/**
 * Tags: Minerva's shared tag system, each user's own, first used by goals
 * (ADR 0026, docs/plans/goals/README.md phase 1).
 */
@Module({
  imports: [GraphQLClientModule],
  providers: [TagService],
  controllers: [
    ListTagsController,
    CreateTagController,
    DescribeTagController,
    UpdateTagController,
    DeleteTagController,
  ],
})
export class TagsModule {}
