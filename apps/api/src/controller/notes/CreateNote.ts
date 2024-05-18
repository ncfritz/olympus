import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
import {
  CreateNoteRequest,
  SingleNoteResponse,
  Note,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Post, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import {
  GraphQlNote,
  toDomainObject,
} from "../../convert/minerva/NoteConverter";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

type GraphQlCreateNoteResponse = {
  insert_minerva_notes_one: GraphQlNote;
};

@Controller()
export class CreateNoteController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
  ) {}

  @Post("/v1/notes")
  @ApiOperation({
    summary: "Creates a new note",
    description: "Creates a new note.",
    operationId: "CreateNote",
  })
  @ApiTags("Notes")
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateNoteRequest,
    required: true,
    description: "Input for the CreateNoteRequest operation",
  })
  @ApiCreatedResponse({
    description: "The record has been successfully created.",
    type: SingleNoteResponse,
    headers: {
      Location: {
        description: "The location of the created job",
      },
    },
  })
  @ApiStandardErrorResponses()
  async handle(
    @Body() request: CreateNoteRequest,
    @Res() response: Response,
  ): Promise<void> {
    console.log(JSON.stringify(request, null, 2));
    const insertRequest = gql`
      mutation CreateNote(
        $author: String!
        $flagged: Boolean!
        $type: numeric!
        $value: String!
        $title: String
        $summary: String
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
          id
          author
          createdTime
          lastUpdatedTime
          deletedTime
          flagged
          type
          title
          summary
          value
          associatedItems {
            itemId
            itemType
            createdTime
          }
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateNoteResponse>(
        insertRequest,
        {
          author: request.note.author,
          type: request.note.type,
          flagged: request.note.flagged,
          value: request.note.value,
          associations: request.note.associations,
        },
      );

    const createdNote: Note = toDomainObject(
      insertResponse.insert_minerva_notes_one,
    );

    const responseBody: SingleNoteResponse = {
      note: createdNote,
    };

    response
      .status(HttpStatus.CREATED)
      .setHeader(
        "Location",
        `http://localhost:3000/api/v1/notes/${encodeURIComponent(
          createdNote.id,
        )}`,
      )
      .send(responseBody);
  }
}
