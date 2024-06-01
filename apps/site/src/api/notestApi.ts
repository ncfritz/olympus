import axios, { type AxiosResponse } from "axios";
import { DateTime } from "luxon";
import { type UpdateNoteResponse } from "../utils/notes";

const createNote = async (note: any) => {
  try {
    const createNoteResponse = await axios.post(
      `/api/v1/notes`,
      { note: note },
      {
        validateStatus: (status) => {
          return status === 201;
        },
      },
    );

    return createNoteResponse;
  } catch (e) {
    throw e;
  }
};

const updateNote = async (id: string, update: any) => {
  try {
    const updateNoteResponse: AxiosResponse<UpdateNoteResponse> =
      await axios.put(
        `/api/v1/note/${id}`,
        { note: update },
        {
          validateStatus: (status) => {
            return status === 200;
          },
        },
      );

    return updateNoteResponse;
  } catch (e) {
    throw e;
  }
};

const deleteNote = async (id: string) => {
  try {
    const deleteNoteResponse: AxiosResponse<UpdateNoteResponse> =
      await axios.delete(`/api/v1/note/${id}`, {
        validateStatus: (status) => {
          return status === 200 || status === 204;
        },
      });

    return deleteNoteResponse;
  } catch (e) {
    throw e;
  }
};

const restoreNote = async (id: string) => {
  try {
    const restoreNoteResponse: AxiosResponse<UpdateNoteResponse> =
      await axios.patch(
        `/api/v1/note/${id}`,
        {},
        {
          validateStatus: (status) => {
            return status === 200;
          },
        },
      );

    return restoreNoteResponse;
  } catch (e) {
    throw e;
  }
};

const getNotes = async (date: DateTime, count = 1) => {
  try {
    const getNotesResponse = await axios.get(
      `/api/v1/notes/${date.toISO()}?count=${count}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getNotesResponse;
  } catch (e) {
    throw e;
  }
};

const getNotesForEntity = async (entityType: string, entityId: string) => {
  try {
    const getNotesResponse = await axios.get(
      `/api/v1/notes/entity/${entityType}/${encodeURIComponent(entityId)}`,
      {
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getNotesResponse;
  } catch (e) {
    throw e;
  }
};

const getSummary = async (start: DateTime, days: number = 30) => {
  try {
    const getSummaryResponse = await axios.get(
      `/api/v1/notes/summary/${start.toISODate()}?days=${days}`,
      {
        headers: {
          "x-ncfritz-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        validateStatus: (status) => {
          return status === 200;
        },
      },
    );

    return getSummaryResponse;
  } catch (e) {
    throw e;
  }
};

const notesApi = {
  createNote: createNote,
  deleteNote: deleteNote,
  getNotes: getNotes,
  getNotesForEntity: getNotesForEntity,
  getSummary: getSummary,
  restoreNote: restoreNote,
  updateNote: updateNote,
};

export default notesApi;
