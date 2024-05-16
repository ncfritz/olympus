import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";

export enum NoteType {}

export class NoteAssociation {
  @ApiProperty({ type: String })
  itemId: string;

  @ApiProperty({ type: String })
  itemType: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;
}

export class PartialNoteAssociation extends PartialType(
  OmitType(NoteAssociation, ["createdTime"]),
) {}

export class BaseNote {
  @ApiProperty({ type: String })
  author: string;

  @ApiProperty({ type: Number })
  type: number;

  @ApiProperty({ type: Boolean })
  flagged: boolean;

  @ApiProperty({ type: String })
  title?: string;

  @ApiProperty({ type: String })
  summary?: string;

  @ApiProperty({ type: String })
  value: string;
}

export class BaseNoteWithAssociations extends BaseNote {
  @ApiProperty({ type: NoteAssociation, isArray: true })
  associations: PartialNoteAssociation[];
}

export class PartialNote extends PartialType(
  OmitType(BaseNoteWithAssociations, ["author"]),
) {}

export class Note extends BaseNote {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({ type: String })
  @Transform(({ value }) => value.toISOString())
  deletedTime?: Moment;

  @ApiProperty({ type: NoteAssociation, isArray: true })
  associations?: NoteAssociation[];
}

export class NoteTypeCounts {
  @ApiProperty({ type: Number })
  note: number;

  @ApiProperty({ type: Number })
  idea: number;

  @ApiProperty({ type: Number })
  thought: number;

  @ApiProperty({ type: Number })
  action: number;

  @ApiProperty({ type: Number })
  question: number;

  @ApiProperty({ type: Number })
  praise: number;

  @ApiProperty({ type: Number })
  total: number;
}

export class CreateNoteRequest {
  @ApiProperty({
    type: () => BaseNoteWithAssociations,
  })
  note: BaseNoteWithAssociations;
}

export class UpdateNoteRequest {
  @ApiProperty({
    type: () => PartialNote,
  })
  note: PartialNote;
}

export class SingleNoteResponse {
  @ApiProperty({
    type: () => BaseNote,
  })
  note: BaseNote;
}

export class ListNotesResponse {
  @ApiProperty({
    type: () => Note,
    isArray: true,
  })
  notes: Note[];
}

export class GetSummaryResponse {
  @ApiProperty({
    type: () => NoteTypeCounts,
  })
  counts: Record<string, NoteTypeCounts>;

  @ApiProperty({
    type: () => NoteTypeCounts,
  })
  hourly: Record<string, NoteTypeCounts>;
}
