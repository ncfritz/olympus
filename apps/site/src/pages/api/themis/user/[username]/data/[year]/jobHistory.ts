import { DateTime, Duration, Interval } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { JobHistoryEntry } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertJobHistoryRequest = {
  entries: JobHistoryEntry[];
};

export type JobHistoryResponse = {
  entries: JobHistoryEntry[];
  firstHireDate: string;
  lastHireDate: string;
  tenure: number;
  fteTenure: number;
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

  const entries = safeLoadJson<JobHistoryEntry[]>(jobHistoryDataPath, [])!;
  const now = DateTime.now().toISODate();
  let lastEndDate: string | undefined = undefined;
  let firstHireDate: string | undefined = undefined;
  let lastHireDate: string | undefined = undefined;
  let tenure = 0;
  let fteTenure = 0;

  entries.forEach((entry) => {
    if (!firstHireDate) {
      firstHireDate = entry.start;
      lastHireDate = entry.start;
    }

    const start = DateTime.fromISO(entry.start);
    const end = DateTime.fromISO(entry.end || now);
    const duration = Interval.fromDateTimes(start, end).length("days");

    tenure += duration;

    if (entry.fte) {
      fteTenure += duration;
    }

    if (!lastEndDate) {
      lastEndDate = entry.start;
    }

    if (lastEndDate !== entry.start) {
      lastHireDate = entry.start;
    }

    lastEndDate = entry.end;
  });

  if (req.method?.toUpperCase() === "GET") {
    const response: JobHistoryResponse = {
      entries: entries,
      firstHireDate: firstHireDate || now,
      lastHireDate: lastHireDate || now,
      tenure: tenure,
      fteTenure: fteTenure,
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
