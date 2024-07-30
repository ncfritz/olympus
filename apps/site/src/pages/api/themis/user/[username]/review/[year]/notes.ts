import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertNotesRequest = {
  notes?: string;
};

export type NotesResponse = {
  notes?: string;
};

const DEFAULT_NOTES: NotesResponse = {
  notes: "",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const notesDataPath = p(`users/${username}/data/${year}/notes.json`);

  if (req.method?.toUpperCase() === "GET") {
    const response = safeLoadJson<NotesResponse>(notesDataPath, DEFAULT_NOTES);

    res.status(200).json(response);
    return;
  }
}
