import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type {
  CodeStat,
  JobHistoryEntry,
} from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertCodeStatsRequest = {
  stats: CodeStat[];
};

export type JCodeStatsResponse = {
  stats: CodeStat[];
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const jobHistoryDataPath = p(`users/${username}/data/${year}/code.json`);

  if (req.method?.toUpperCase() === "GET") {
    const response = {
      stats: safeLoadJson<JobHistoryEntry[]>(jobHistoryDataPath, []),
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const newEntries = req.body as UpsertCodeStatsRequest;

    console.log(newEntries);

    fs.writeFileSync(
      jobHistoryDataPath,
      JSON.stringify(newEntries.stats, null, 2),
    );

    res.status(200).json({
      stats: newEntries,
    });
    return;
  }

  res.status(501).end();
}
