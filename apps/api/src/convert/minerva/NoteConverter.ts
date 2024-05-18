import { Note, NoteAssociation, NoteType } from "@ncfritz/olympus-model";
import moment from "moment/moment";

export type GraphQlNoteAssociation = {
  itemId: string;
  itemType: string;
  createdTime: string;
};

export type GraphQlNote = {
  id: string;
  type: NoteType;
  author: string;
  flagged: boolean;
  value: string;
  title?: string;
  summary?: string;
  createdTime: string;
  lastUpdatedTime: string;
  deletedTime?: string;
  associatedItems?: GraphQlNoteAssociation[];
};

const associationToDomainObject = (
  input: GraphQlNoteAssociation,
): NoteAssociation => {
  return {
    itemId: input.itemId,
    itemType: input.itemType,
    createdTime: moment(input.createdTime),
  };
};

export const toDomainObject = (input: GraphQlNote): Note => {
  const associations: NoteAssociation[] = [];

  if (input.associatedItems && input.associatedItems.length > 0) {
    input.associatedItems.forEach((association) => {
      associations.push(associationToDomainObject(association));
    });
  }

  return {
    id: input.id,
    author: input.author,
    flagged: input.flagged,
    type: input.type,
    title: input.title,
    summary: input.summary,
    value: input.value,
    createdTime: moment(input.createdTime),
    lastUpdatedTime: moment(input.lastUpdatedTime),
    deletedTime: input.deletedTime ? moment(input.deletedTime) : undefined,
    associations: associations,
  };
};
