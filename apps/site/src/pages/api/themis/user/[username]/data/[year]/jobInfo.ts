import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { JobInfo } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertJobInfoRequest = {
  jobInfo: JobInfo;
};

export type ReviewJobInfoResponse = {
  jobInfo: JobInfo;
};

const DEFAULT_JOB_INFO: JobInfo = {
  employeeId: "",
  departmentId: "",
  departmentName: "",
  title: "",
  jobTitle: "",
  level: -1,
  isManager: false,
  isInPivot: false,
  isNotifiedOfPivot: false,
  isUnderPerformanceCoaching: false,
  promotionQuarter: undefined,
  promotionYear: undefined,
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const jobInfoDataPath = p(`users/${username}/data/${year}/jobInfo.json`);

  if (req.method?.toUpperCase() === "GET") {
    const response = {
      jobInfo: safeLoadJson<JobInfo>(jobInfoDataPath, DEFAULT_JOB_INFO),
    };

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const newJobInfo = req.body as UpsertJobInfoRequest;

    fs.writeFileSync(
      jobInfoDataPath,
      JSON.stringify(newJobInfo.jobInfo, null, 2),
    );

    res.status(200).json({
      jobInfo: newJobInfo,
    });
    return;
  }

  res.status(501).end();
}
