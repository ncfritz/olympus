import {
  ApiExtraModels,
  ApiProperty,
  getSchemaPath,
  OmitType,
  PartialType,
} from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Moment } from "moment";

export enum NoteType {
  NOTE = 0,
  IDEA = 1,
  THOUGHT = 2,
  ACTION = 3,
  PRAISE = 4,
  QUESTION = 5,
}

export class NoteAssociation {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The ID of the item associated with the note.  It is up to the implementor to encode any compound IDs - " +
      "A JSON serialized string, possibly Base64 encoded is recommended",
  })
  itemId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The type of item associated with the note.",
  })
  itemType: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the association was created",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;
}

export class PartialNoteAssociation extends PartialType(
  OmitType(NoteAssociation, ["createdTime"]),
) {}

export class BaseNote {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "The author of the note.  This should be a user ID that can be traced back to a registered user",
  })
  author: string;

  @ApiProperty({
    enum: () => NoteType,
    enumName: "NoteType",
    required: true,
    description: "The type of then note",
  })
  type: NoteType;

  @ApiProperty({
    type: Boolean,
    required: true,
    description: "`true` if the note has been flagged, `false` otherwise",
  })
  flagged: boolean;

  @ApiProperty({
    type: String,
    required: false,
    description: "A short title describing the note",
  })
  title?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "A Brief summary on the contents of the note. Use this when the note " +
      "body may be long and a executive summary could be helpful for " +
      "consumers of the note",
  })
  summary?: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "T actual content of the note",
  })
  value: string;
}

export class BaseNoteWithAssociations extends BaseNote {
  @ApiProperty({
    type: PartialNoteAssociation,
    isArray: true,
    required: true,
    description: "The set of associations for the note",
  })
  associations: PartialNoteAssociation[];
}

export class PartialNote extends PartialType(
  OmitType(BaseNoteWithAssociations, ["author"]),
) {}

export class Note extends BaseNote {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the note",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the note was created",
  })
  @Transform(({ value }) => value.toISOString())
  createdTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the note was last updated",
  })
  @Transform(({ value }) => value.toISOString())
  lastUpdatedTime: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the note was marked as deleted",
  })
  @Transform(({ value }) => value.toISOString())
  deletedTime?: Moment;

  @ApiProperty({
    type: NoteAssociation,
    isArray: true,
    required: false,
    description: "The set of associations for the note",
  })
  associations?: NoteAssociation[];

  @ApiProperty({
    type: Boolean,
    required: true,
    description:
      "`true` if the note is a child - i.e. the note has a parent note, `false` otherwise`",
  })
  hasParent: boolean;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of children this note has.  This value only represents the direct children and " +
      "does no account for a nested child note structure.",
  })
  childCount: number;
}

export class NoteTypeCounts {
  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of notes marked as `NOTE` for the requested time period",
  })
  note: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of notes marked as `IDEA` for the requested time period",
  })
  idea: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of notes marked as `THOUGHT` for the requested time period",
  })
  thought: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of notes marked as `ACTION` for the requested time period",
  })
  action: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of notes marked as `QUESTION` for the requested time period",
  })
  question: number;

  @ApiProperty({
    type: Number,
    required: true,
    description:
      "The number of notes marked as `PRAISE` for the requested time period",
  })
  praise: number;

  @ApiProperty({
    type: Number,
    required: true,
    description: "The total number of notes for the requested time period",
  })
  total: number;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */
export class CreateNoteRequest {
  @ApiProperty({
    type: () => BaseNoteWithAssociations,
    required: true,
    description: "The note to be created",
  })
  note: BaseNoteWithAssociations;
}

export class UpdateNoteRequest {
  @ApiProperty({
    type: () => PartialNote,
    required: true,
    description: "The a partial note containing the updated to be made",
  })
  note: PartialNote;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
export class SingleNoteResponse {
  @ApiProperty({
    type: () => Note,
    required: true,
    description: "A note that has been created, updated, or queried",
  })
  note: Note;
}

export class ListNotesResponse {
  @ApiProperty({
    type: () => Note,
    isArray: true,
    required: true,
    description: "A list of notes",
  })
  notes: Note[];
}

@ApiExtraModels(NoteTypeCounts)
export class GetSummaryResponse {
  @ApiProperty({
    type: () => Object,
    required: true,
    additionalProperties: {
      $ref: getSchemaPath(NoteTypeCounts),
    },
    description:
      "A mapping of ISO-8601 dates to note count statistics for each day",
  })
  counts: Record<string, NoteTypeCounts>;

  @ApiProperty({
    type: () => Object,
    required: true,
    additionalProperties: {
      $ref: getSchemaPath(NoteTypeCounts),
    },
    description:
      "A mapping of the hour of day to note count statistics for each hour of the day",
  })
  hourly: Record<string, NoteTypeCounts>;
}
