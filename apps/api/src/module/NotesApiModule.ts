import { Module } from "@nestjs/common";
import { CreateNoteController } from "../controller/notes/CreateNote";
import { DeleteNoteController } from "../controller/notes/DeleteNote";
import { DescribeNoteController } from "../controller/notes/DescribeNote";
import { GetNotesForEntityController } from "../controller/notes/GetNotesForEntity";
import { GetMonthlySummaryController } from "../controller/notes/GetNotesSummary";
import { ListNotesForDayController } from "../controller/notes/ListNotesForDay";
import { RestoreNoteController } from "../controller/notes/RestoreNote";
import { UpdateNoteController } from "../controller/notes/UpdateNote";
import { GraphQLClientModule } from "./GraphQLClientModule";

@Module({
  imports: [GraphQLClientModule],
  exports: [],
  providers: [],
  controllers: [
    CreateNoteController,
    DescribeNoteController,
    UpdateNoteController,
    DeleteNoteController,
    RestoreNoteController,
    ListNotesForDayController,
    GetMonthlySummaryController,
    GetNotesForEntityController,
  ],
})
export class NotesApiModule {}
