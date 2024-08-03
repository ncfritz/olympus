import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type { Mentee } from "../../../../../../../types/themis";
import { p, safeLoadJson } from "../../../../../../../utils/themis";

export type UpsertMentorshipRequest = {
  mentorship: Mentee[];
};

export type MentorshipResponse = {
  mentorship: Mentee[];
};

const DEFAULT_MENTORSHIP: MentorshipResponse = {
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
    const response = safeLoadJson<MentorshipResponse>(
      mentorshipDataPath,
      DEFAULT_MENTORSHIP,
    );

    res.status(200).json(response);
    return;
  } else if (req.method?.toUpperCase() === "PUT") {
    const newMentees = req.body as UpsertMentorshipRequest;

    fs.writeFileSync(mentorshipDataPath, JSON.stringify(newMentees, null, 2));

    res.status(200).json(newMentees);
    return;
  }

  res.status(501).end();
}
