import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { Mentee } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type MentorshipReviewResponse = {
  mentorship: Mentee[];
};

const DEFAULT_MENTORSHIP: MentorshipReviewResponse = {
  mentorship: [],
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username;
  const year = req.query.year;
  const userDataPath = p(`users/${username}/data/${year}`);

  if (!fs.existsSync(userDataPath)) {
    res.status(404).end();
    return;
  }

  const mentorshipDataPath = p(
    `users/${username}/data/${year}/mentorship.json`,
  );

  if (req.method?.toUpperCase() === "GET") {
    const response = safeLoadJson<MentorshipReviewResponse>(
      mentorshipDataPath,
      DEFAULT_MENTORSHIP,
    );

    res.status(200).json(response);
    return;
  }
}
