import { BaseNoteWithAssociations } from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNote,
  toDomainObject,
} from "../../../convert/minerva/NoteConverter";
import { NOTE_WITH_ASSOCIATIONS } from "../../../query/minerva/notes";

type GraphQlCreateNoteResponse = {
  insert_minerva_notes_one: GraphQlNote;
};

export abstract class BaseNoteController {
  protected constructor(protected readonly graphQLClient: GraphQLClient) {}

  async createNote(
    note: BaseNoteWithAssociations,
    parentId: string | undefined = undefined,
  ) {
    const insertRequest = gql`
      mutation CreateNote(
        $author: String!
        $flagged: Boolean!
        $type: numeric!
        $value: String!
        $title: String
        $summary: String
        $parentId: uuid
        $associations: [minerva_note_associations_insert_input!]!
      ) {
        insert_minerva_notes_one(
          object: {
            author: $author
            flagged: $flagged
            type: $type
            value: $value
            title: $title
            summary: $summary
            parent_id: $parentId
            associatedItems: {
              on_conflict: { constraint: note_associations_pkey }
              data: $associations
            }
          }
          on_conflict: {
            constraint: notes_pkey
            update_columns: [flagged, type, value]
          }
        ) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateNoteResponse>(
        insertRequest,
        {
          author: note.author,
          type: note.type,
          flagged: note.flagged,
          value: note.value,
          summary: note.summary,
          title: note.title,
          associations: note.associations,
          parentId: parentId,
        },
      );

    return toDomainObject(insertResponse.insert_minerva_notes_one);
  }
}
