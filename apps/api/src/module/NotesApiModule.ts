import { Module } from "@nestjs/common";
import { CreateNoteController } from "../controller/minerva/notes/CreateNote";
import { DeleteNoteController } from "../controller/minerva/notes/DeleteNote";
import { DescribeNoteController } from "../controller/minerva/notes/DescribeNote";
import { GetNotesForEntityController } from "../controller/minerva/notes/GetNotesForEntity";
import { GetMonthlySummaryController } from "../controller/minerva/notes/GetNotesSummary";
import { ListNotesForDayController } from "../controller/minerva/notes/ListNotesForDay";
import { RestoreNoteController } from "../controller/minerva/notes/RestoreNote";
import { UpdateNoteController } from "../controller/minerva/notes/UpdateNote";
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
