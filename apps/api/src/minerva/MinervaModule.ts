import { Module } from "@nestjs/common";
import { MeetingsModule } from "./meetings/MeetingsModule";
import { NotesModule } from "./notes/NotesModule";

/** Feature modules served under /minerva, in OpenAPI document order. */
export const MINERVA_MODULES = [MeetingsModule, NotesModule];

@Module({ imports: MINERVA_MODULES })
export class MinervaModule {}
