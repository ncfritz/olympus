import { Module } from "@nestjs/common";
import { CalendarsModule } from "./calendars/CalendarsModule";
import { GoalsModule } from "./goals/GoalsModule";
import { MeetingsModule } from "./meetings/MeetingsModule";
import { NotesModule } from "./notes/NotesModule";
import { ReviewsModule } from "./reviews/ReviewsModule";
import { TagsModule } from "./tags/TagsModule";

/** Feature modules served under /minerva, in OpenAPI document order. */
export const MINERVA_MODULES = [
  MeetingsModule,
  NotesModule,
  TagsModule,
  GoalsModule,
  ReviewsModule,
  CalendarsModule,
];

@Module({ imports: MINERVA_MODULES })
export class MinervaModule {}
