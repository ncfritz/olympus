import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { JobHistoryEntry } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertJobHistoryRequest = {
  entries: JobHistoryEntry;
};

export type JobHistoryResponse = {
  entries: JobHistoryEntry;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const jobHistoryDataPath = p(
    `users/${username}/data/${year}/jobHistory.json`,
  );

  if (req.method?.toUpperCase() === "GET") {
    const response = {
      entries: safeLoadJson<JobHistoryEntry[]>(jobHistoryDataPath, []),
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const newEntries = req.body as UpsertJobHistoryRequest;

    fs.writeFileSync(
      jobHistoryDataPath,
      JSON.stringify(newEntries.entries, null, 2),
    );

    res.status(200).json({
      entries: newEntries,
    });
    return;
  }

  res.status(501).end();
}
