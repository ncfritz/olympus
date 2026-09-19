import {
  FilterDefinition,
  FilterType,
  ListNotesResponse,
  Note,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { gql, GraphQLClient } from "graphql-request";
import { GraphQlNote, toDomainObject } from "../converters/NoteConverter";
import { NOTE_WITH_ASSOCIATIONS } from "../queries/notes";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { buildFilterExpression } from "../../../utils/filterUtil";

type GraphQlListNotesResponse = {
  minerva_notes: GraphQlNote[];
};

@Controller({ version: "1" })
export class ListChildNotesController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/note/:noteId/children")
  @ApiOperation({
    summary: "Lists child notes",
    description: "Lists notes that are a child of the specified note.",
    operationId: "ListChildNotes",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "noteId",
    description: "The ID of the note to list children for",
    type: String,
  })
  @ApiOkResponse({
    description: "The notes have been successfully fetched.",
    type: ListNotesResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    const authorFilter: FilterDefinition = {
      name: "author",
      type: FilterType.EQUALS,
      value: "ncfritz",
    };
    const parentFilter: FilterDefinition = {
      name: "parent_id",
      type: FilterType.EQUALS,
      value: noteId,
    };
    const filters: FilterDefinition = {
      name: "_",
      type: FilterType.AND,
      value: [authorFilter, parentFilter],
    };

    const whereExpression = buildFilterExpression(filters);

    const queryRequest = gql`
      query ListChildNotes {
        minerva_notes(
          ${whereExpression},
          order_by: { createdTime: desc }
        ) {
          ${NOTE_WITH_ASSOCIATIONS}
        }
      }
    `;

    const queryResponse =
      await this.graphQLClient.request<GraphQlListNotesResponse>(queryRequest);

    const notes: Note[] = [];
    queryResponse.minerva_notes.forEach((note) => {
      notes.push(toDomainObject(note));
    });

    const responseBody: ListNotesResponse = {
      notes: notes,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
