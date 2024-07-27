import { DateTime } from "luxon";
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import type {
  CRStat,
  JobInfo,
  PeerCRStats,
} from "../../../../../../../types/themis";
import {
  buildMinMaxAvg,
  p,
  safeLoadJson,
} from "../../../../../../../utils/themis";
import type { RawReviewData } from "../../../../review/[year]/usersSummary";

export type CRStatsReviewResponse = {
  reviewYear: string;
  crYear: string;
  stats: Record<string, CRStat[]>;
  peers: string[];
  peerStats: PeerCRStats;
  peersInLevel: string[];
  peersInLevelStats: PeerCRStats;
};

type PeerAggregate = {
  authored: number[][];
  received: number[][];
  commented: number[][];
  approved: number[][];
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
      const stats: Record<string, CRStat[]> = {};

      reviewYears.forEach((reviewYear) => {
        const codeStatisticsDataPath = p(
          `users/${username}/data/${reviewYear}/cr.json`,
        );

        if (req.method?.toUpperCase() === "GET") {
          stats[reviewYear.toString()] = safeLoadJson<CRStat[]>(
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
        authored: new Array(targetYear.weeksInWeekYear),
        received: new Array(targetYear.weeksInWeekYear),
        commented: new Array(targetYear.weeksInWeekYear),
        approved: new Array(targetYear.weeksInWeekYear),
      };
      const peersInLevelAggregate: PeerAggregate = {
        authored: new Array(targetYear.weeksInWeekYear),
        received: new Array(targetYear.weeksInWeekYear),
        commented: new Array(targetYear.weeksInWeekYear),
        approved: new Array(targetYear.weeksInWeekYear),
      };

      peers.forEach((peerUsername) => {
        const peerStats = safeLoadJson<CRStat[]>(
          p(`users/${peerUsername}/data/${targetYear.year - 1}/cr.json`),
          [],
        );

        peerStats?.forEach((stat) => {
          if (!peersAggregate.authored[stat.week - 1]) {
            peersAggregate.authored[stat.week - 1] = [];
          }

          peersAggregate.authored[stat.week - 1].push(stat.authored);

          if (!peersAggregate.received[stat.week - 1]) {
            peersAggregate.received[stat.week - 1] = [];
          }

          peersAggregate.received[stat.week - 1].push(stat.received);

          if (!peersAggregate.commented[stat.week - 1]) {
            peersAggregate.commented[stat.week - 1] = [];
          }

          peersAggregate.commented[stat.week - 1].push(stat.commented);

          if (!peersAggregate.approved[stat.week - 1]) {
            peersAggregate.approved[stat.week - 1] = [];
          }

          peersAggregate.approved[stat.week - 1].push(stat.approved);

          if (peersInLevel.includes(peerUsername)) {
            if (!peersInLevelAggregate.authored[stat.week - 1]) {
              peersInLevelAggregate.authored[stat.week - 1] = [];
            }

            peersInLevelAggregate.authored[stat.week - 1].push(stat.authored);

            if (!peersInLevelAggregate.received[stat.week - 1]) {
              peersInLevelAggregate.received[stat.week - 1] = [];
            }

            peersInLevelAggregate.received[stat.week - 1].push(stat.received);

            if (!peersInLevelAggregate.commented[stat.week - 1]) {
              peersInLevelAggregate.commented[stat.week - 1] = [];
            }

            peersInLevelAggregate.commented[stat.week - 1].push(stat.commented);

            if (!peersInLevelAggregate.approved[stat.week - 1]) {
              peersInLevelAggregate.approved[stat.week - 1] = [];
            }

            peersInLevelAggregate.approved[stat.week - 1].push(stat.approved);
          }
        });
      });

      const peerStats: PeerCRStats = {
        min: [],
        max: [],
        average: [],
      };

      for (let i = 0; i < targetYear.weeksInWeekYear; i++) {
        const authoredMinMaxAvg = buildMinMaxAvg(peersAggregate.authored[i]);
        const receivedMinMaxAvg = buildMinMaxAvg(peersAggregate.received[i]);
        const commentedMinMaxAvg = buildMinMaxAvg(peersAggregate.commented[i]);
        const approvedMinMaxAvg = buildMinMaxAvg(peersAggregate.approved[i]);

        peerStats.min.push({
          week: i + 1,
          authored: authoredMinMaxAvg.min,
          received: receivedMinMaxAvg.min,
          commented: commentedMinMaxAvg.min,
          approved: approvedMinMaxAvg.min,
        });
        peerStats.max.push({
          week: i + 1,
          authored: authoredMinMaxAvg.max,
          received: receivedMinMaxAvg.max,
          commented: commentedMinMaxAvg.max,
          approved: approvedMinMaxAvg.max,
        });
        peerStats.average.push({
          week: i + 1,
          authored: authoredMinMaxAvg.average,
          received: receivedMinMaxAvg.average,
          commented: commentedMinMaxAvg.average,
          approved: approvedMinMaxAvg.average,
        });
      }

      const peersInLevelStats: PeerCRStats = {
        min: [],
        max: [],
        average: [],
      };

      for (let i = 0; i < targetYear.weeksInWeekYear; i++) {
        const authoredMinMaxAvg = buildMinMaxAvg(
          peersInLevelAggregate.authored[i],
        );
        const receivedMinMaxAvg = buildMinMaxAvg(
          peersInLevelAggregate.received[i],
        );
        const commentedMinMaxAvg = buildMinMaxAvg(
          peersInLevelAggregate.commented[i],
        );
        const approvedMinMaxAvg = buildMinMaxAvg(
          peersInLevelAggregate.approved[i],
        );

        peersInLevelStats.min.push({
          week: i + 1,
          authored: authoredMinMaxAvg.min,
          received: receivedMinMaxAvg.min,
          commented: commentedMinMaxAvg.min,
          approved: approvedMinMaxAvg.min,
        });
        peersInLevelStats.max.push({
          week: i + 1,
          authored: authoredMinMaxAvg.max,
          received: receivedMinMaxAvg.max,
          commented: commentedMinMaxAvg.max,
          approved: approvedMinMaxAvg.max,
        });
        peersInLevelStats.average.push({
          week: i + 1,
          authored: authoredMinMaxAvg.average,
          received: receivedMinMaxAvg.average,
          commented: commentedMinMaxAvg.average,
          approved: approvedMinMaxAvg.average,
        });
      }

      const response: CRStatsReviewResponse = {
        reviewYear: year,
        crYear: `${targetYear.year - 1}`,
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
