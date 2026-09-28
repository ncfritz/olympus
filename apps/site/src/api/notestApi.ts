import {
  type BaseNoteWithAssociations,
  client,
  createChildNote,
  createNote,
  deleteNote,
  getNotesForEntity,
  getNotesSummary,
  listChildNotes,
  listNotesForDay,
  type PartialNote,
  restoreNote,
  updateNote,
} from "@ncfritz/olympus-sdk/minerva";
import { DateTime } from "luxon";

class NotesApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  private buildHeaders(existing?: Record<string, string>) {
    return {
      headers: {
        ...existing,
        "x-ncfritz-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  async createNote(note: BaseNoteWithAssociations) {
    return await createNote({
      body: {
        note: note,
      },
      ...this.buildHeaders(),
    });
  }

  async createChildNote(note: BaseNoteWithAssociations, parentId: string) {
    return await createChildNote({
      path: {
        noteId: parentId,
      },
      body: {
        note: note,
      },
      ...this.buildHeaders(),
    });
  }

  async updateNote(id: string, update: PartialNote) {
    return await updateNote({
      path: {
        noteId: id,
      },
      body: {
        note: update,
      },
      ...this.buildHeaders(),
    });
  }

  async deleteNote(id: string) {
    return await deleteNote({
      path: {
        noteId: id,
      },
      ...this.buildHeaders(),
    });
  }

  async restoreNote(id: string) {
    return await restoreNote({
      path: {
        noteId: id,
      },
      ...this.buildHeaders(),
    });
  }

  async getNotes(start: DateTime, days = 1) {
    return await listNotesForDay({
      path: {
        start: start.toISO()!,
      },
      query: {
        days: days,
      },
      ...this.buildHeaders(),
    });
  }

  async getChildNotes(parentId: string) {
    return await listChildNotes({
      path: {
        noteId: parentId,
      },
      ...this.buildHeaders(),
    });
  }

  async getNotesForEntity(entityType: string, entityId: string) {
    return await getNotesForEntity({
      path: {
        entityId: encodeURIComponent(entityId),
        entityType: entityType,
      },
      ...this.buildHeaders(),
    });
  }

  async getSummary(start: DateTime, days = 30) {
    return await getNotesSummary({
      path: {
        start: start.toISO()!,
      },
      query: {
        days: days,
      },
      ...this.buildHeaders(),
    });
  }
}

const notesApi = new NotesApi();
export default notesApi;
