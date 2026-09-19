import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CreateChildNoteController } from "./controllers/CreateChildNoteController";
import { CreateNoteController } from "./controllers/CreateNoteController";
import { DeleteNoteController } from "./controllers/DeleteNoteController";
import { DescribeNoteController } from "./controllers/DescribeNoteController";
import { GetNotesForEntityController } from "./controllers/GetNotesForEntityController";
import { GetNotesSummaryController } from "./controllers/GetNotesSummaryController";
import { ListChildNotesController } from "./controllers/ListChildNotesController";
import { ListNotesForDayController } from "./controllers/ListNotesForDayController";
import { RestoreNoteController } from "./controllers/RestoreNoteController";
import { UpdateNoteController } from "./controllers/UpdateNoteController";

@Module({
  imports: [GraphQLClientModule],
  controllers: [
    CreateChildNoteController,
    CreateNoteController,
    DeleteNoteController,
    DescribeNoteController,
    GetNotesForEntityController,
    GetNotesSummaryController,
    ListChildNotesController,
    ListNotesForDayController,
    RestoreNoteController,
    UpdateNoteController,
  ],
})
export class NotesModule {}
