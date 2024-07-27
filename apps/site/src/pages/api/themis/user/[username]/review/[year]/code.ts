import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type {
  CodeStat,
  JobInfo,
  PeerCodeStats,
} from "../../../../../../../types/themis";
import {
  buildMinMaxAvg,
  p,
  safeLoadJson,
} from "../../../../../../../utils/themis";
import type { RawReviewData } from "../../../../review/[year]/usersSummary";

export type CodeStatsReviewResponse = {
  reviewYear: string;
  codeYear: string;
  stats: Record<string, CodeStat[]>;
  peers: string[];
  peerStats: PeerCodeStats;
  peersInLevel: string[];
  peersInLevelStats: PeerCodeStats;
};

type PeerAggregate = {
  added: number[][];
  removed: number[][];
  changes: number[][];
  packages: number[][];
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const username = req.query.username as string;
  const year = req.query.year as string;
  const userDataPath = p(`users/${username}/data/${year}`);

  try {
    if (!fs.existsSync(userDataPath)) {
      res.status(404).end();
      return;
    }

    if (req.method?.toUpperCase() === "GET") {
      const targetYear = DateTime.fromISO(year);
      const reviewYears = [targetYear.year - 1, targetYear.year - 2];
      const stats: Record<string, CodeStat[]> = {};

      reviewYears.forEach((reviewYear) => {
        const codeStatisticsDataPath = p(
          `users/${username}/data/${reviewYear}/code.json`,
        );

        if (req.method?.toUpperCase() === "GET") {
          stats[reviewYear.toString()] = safeLoadJson<CodeStat[]>(
            codeStatisticsDataPath,
            [],
          )!;
        }
      });

      const userLevel = getUserLevel(username, year);
      const peers: string[] = [];
      const peersInLevel: string[] = [];

      const reviewYear = safeLoadJson<RawReviewData>(
        p(`years/${year}/review.json`),
        { users: [] },
      );

      reviewYear?.users
        .filter((user) => {
          return user !== username;
        })
        .forEach((peerUsername) => {
          const peerLevel = getUserLevel(peerUsername, year);
          peers.push(peerUsername);

          if (peerLevel === userLevel) {
            peersInLevel.push(peerUsername);
          }
        });

      const peersAggregate: PeerAggregate = {
        added: new Array(targetYear.weeksInWeekYear),
        removed: new Array(targetYear.weeksInWeekYear),
        changes: new Array(targetYear.weeksInWeekYear),
        packages: new Array(targetYear.weeksInWeekYear),
      };
      const peersInLevelAggregate: PeerAggregate = {
        added: new Array(targetYear.weeksInWeekYear),
        removed: new Array(targetYear.weeksInWeekYear),
        changes: new Array(targetYear.weeksInWeekYear),
        packages: new Array(targetYear.weeksInWeekYear),
      };

      peers.forEach((peerUsername) => {
        const peerStats = safeLoadJson<CodeStat[]>(
          p(`users/${peerUsername}/data/${targetYear.year - 1}/code.json`),
          [],
        );

        peerStats?.forEach((stat) => {
          if (!peersAggregate.added[stat.week - 1]) {
            peersAggregate.added[stat.week - 1] = [];
          }

          peersAggregate.added[stat.week - 1].push(stat.added);

          if (!peersAggregate.removed[stat.week - 1]) {
            peersAggregate.removed[stat.week - 1] = [];
          }

          peersAggregate.removed[stat.week - 1].push(stat.removed);

          if (!peersAggregate.changes[stat.week - 1]) {
            peersAggregate.changes[stat.week - 1] = [];
          }

          peersAggregate.changes[stat.week - 1].push(stat.changes);

          if (!peersAggregate.packages[stat.week - 1]) {
            peersAggregate.packages[stat.week - 1] = [];
          }

          peersAggregate.packages[stat.week - 1].push(stat.packages);

          if (peersInLevel.includes(peerUsername)) {
            if (!peersInLevelAggregate.added[stat.week - 1]) {
              peersInLevelAggregate.added[stat.week - 1] = [];
            }

            peersInLevelAggregate.added[stat.week - 1].push(stat.added);

            if (!peersInLevelAggregate.removed[stat.week - 1]) {
              peersInLevelAggregate.removed[stat.week - 1] = [];
            }

            peersInLevelAggregate.removed[stat.week - 1].push(stat.removed);

            if (!peersInLevelAggregate.changes[stat.week - 1]) {
              peersInLevelAggregate.changes[stat.week - 1] = [];
            }

            peersInLevelAggregate.changes[stat.week - 1].push(stat.changes);

            if (!peersInLevelAggregate.packages[stat.week - 1]) {
              peersInLevelAggregate.packages[stat.week - 1] = [];
            }

            peersInLevelAggregate.packages[stat.week - 1].push(stat.packages);
          }
        });
      });

      const peerStats: PeerCodeStats = {
        min: [],
        max: [],
        average: [],
      };

      for (let i = 0; i < targetYear.weeksInWeekYear; i++) {
        const addedMinMaxAvg = buildMinMaxAvg(peersAggregate.added[i]);
        const removedMinMaxAvg = buildMinMaxAvg(peersAggregate.removed[i]);
        const changesMinMaxAvg = buildMinMaxAvg(peersAggregate.changes[i]);
        const packagedMinMaxAvg = buildMinMaxAvg(peersAggregate.packages[i]);

        peerStats.min.push({
          week: i + 1,
          added: addedMinMaxAvg.min,
          removed: removedMinMaxAvg.min,
          changes: changesMinMaxAvg.min,
          packages: packagedMinMaxAvg.min,
        });
        peerStats.max.push({
          week: i + 1,
          added: addedMinMaxAvg.max,
          removed: removedMinMaxAvg.max,
          changes: changesMinMaxAvg.max,
          packages: packagedMinMaxAvg.max,
        });
        peerStats.average.push({
          week: i + 1,
          added: addedMinMaxAvg.average,
          removed: removedMinMaxAvg.average,
          changes: changesMinMaxAvg.average,
          packages: packagedMinMaxAvg.average,
        });
      }

      const peersInLevelStats: PeerCodeStats = {
        min: [],
        max: [],
        average: [],
      };

      for (let i = 0; i < targetYear.weeksInWeekYear; i++) {
        const addedMinMaxAvg = buildMinMaxAvg(peersInLevelAggregate.added[i]);
        const removedMinMaxAvg = buildMinMaxAvg(
          peersInLevelAggregate.removed[i],
        );
        const changesMinMaxAvg = buildMinMaxAvg(
          peersInLevelAggregate.changes[i],
        );
        const packagedMinMaxAvg = buildMinMaxAvg(
          peersInLevelAggregate.packages[i],
        );

        peersInLevelStats.min.push({
          week: i + 1,
          added: addedMinMaxAvg.min,
          removed: removedMinMaxAvg.min,
          changes: changesMinMaxAvg.min,
          packages: packagedMinMaxAvg.min,
        });
        peersInLevelStats.max.push({
          week: i + 1,
          added: addedMinMaxAvg.max,
          removed: removedMinMaxAvg.max,
          changes: changesMinMaxAvg.max,
          packages: packagedMinMaxAvg.max,
        });
        peersInLevelStats.average.push({
          week: i + 1,
          added: addedMinMaxAvg.average,
          removed: removedMinMaxAvg.average,
          changes: changesMinMaxAvg.average,
          packages: packagedMinMaxAvg.average,
        });
      }

      const response: CodeStatsReviewResponse = {
        reviewYear: year,
        codeYear: `${targetYear.year - 1}`,
        stats: stats,
        peers: peers,
        peerStats: peerStats,
        peersInLevel: peersInLevel,
        peersInLevelStats: peersInLevelStats,
      };

      res.status(200).json(response);
      return;
    }
  } catch (e) {
    console.log(e);
  }

  res.status(501).end();
}

const getUserLevel = (username: string, year: string): number => {
  let level = 1000;

  try {
    const jobInfo = safeLoadJson<JobInfo>(
      p(`users/${username}/data/${year}/jobInfo.json`),
    );

    level = jobInfo!.level;
  } catch (e) {
    // Ignore
  }

  return level;
};
