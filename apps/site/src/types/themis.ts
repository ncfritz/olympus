import Review = google.maps.places.Review;

export type BaseBasicUserInfo = {
  givenName: string;
  surname: string;
  hireDate: string;
};

export type BasicUserInfo = BaseBasicUserInfo & {
  username: string;
};

export type ReviewYearUsers = {
  users: string[];
};

export type ReviewYear = {
  year: string;
  ratingsComplete: number;
  users: BasicUserInfo[];
};

export type UserDataSummary = {
  jobInfo: boolean;
  performance: boolean;
  jobHistory: boolean;
  forteHistory: boolean;
  notes: boolean;
  mentorship: boolean;
  code: boolean;
  cr: boolean;
  sim: boolean;
  hiring: boolean;
  bbCard: boolean;
};

export type UserDataYearsSummary = {
  jobInfo: string[];
  performance: string[];
  jobHistory: string[];
  forteHistory: string[];
  notes: string[];
  mentorship: string[];
  code: string[];
  cr: string[];
  sim: string[];
  hiring: string[];
  bbCard: string[];
};

export type OverallRating =
  | "Unknown"
  | "NA"
  | "LE"
  | "HV1"
  | "HV2"
  | "HV3"
  | "TT";
export type PerformanceRating =
  | "Unknown"
  | "NA"
  | "NI1"
  | "NI2"
  | "NI3"
  | "M1"
  | "M2"
  | "E1"
  | "E2";
export type PotentialRating = "Unknown" | "NA" | "L" | "M" | "H" | "VH";
export type CriticalityRating = "Unknown" | "vh" | "h" | "m" | "l";

export type ReviewRating = {
  growth: PotentialRating;
  overall: OverallRating;
  performance: PerformanceRating;
};

export type ExtendedReviewRating = ReviewRating & {
  year: string;
  quarter: string;
  focal: boolean;
}

export type JobHistoryEntry = {
  jobTitle: string;
  start: string;
  end?: string;
  level: number;
  fte: boolean;
};

export type JobInfo = {
  employeeId: string;
  title: string;
  jobTitle: string;
  departmentName: string;
  departmentId: string;
  isManager: boolean;
  level: number;
  isUnderPerformanceCoaching: boolean;
  isInPivot: boolean;
  isNotifiedOfPivot: boolean;
  promotionQuarter?: string;
  promotionYear?: string;
};

export type CodeStat = {
  week: number;
  changes: number;
  added: number;
  removed: number;
  packages: number;
};

export type CRStat = {
  week: number;
  authored: number;
  commented: number;
  received: number;
  approved: number;
};

export type ForteResult = {
  strength: number;
  opportunity: number;
};

export type ForteSummary = {
  customerObsession: ForteResult;
  ownership: ForteResult;
  inventSimplify: ForteResult;
  areRightALot: ForteResult;
  learnBeCurious: ForteResult;
  hireDevelop: ForteResult;
  insistHighestStandards: ForteResult;
  thinkBig: ForteResult;
  biasForAction: ForteResult;
  frugality: ForteResult;
  earnTrust: ForteResult;
  diveDeep: ForteResult;
  backbone: ForteResult;
  deliverResults: ForteResult;
  bestEmployer: ForteResult;
  successScale: ForteResult;
};

export type SimMetric = "1" | "2" | "3" | "4" | "5" | "99";

export type SimSeverityStats = {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
  "99": number;
  total: number;
};

export type SimStat = {
  week: number;
  created: SimSeverityStats;
  resolved: SimSeverityStats;
};

export const DATA_PATHS: Record<keyof UserDataSummary, string> = {
  jobInfo: "jobInfo.json",
  performance: "rating.json",
  jobHistory: "jobHistory.json",
  forteHistory: "forte.json",
  notes: "notes.json",
  mentorship: "mentorship.json",
  code: "code.json",
  cr: "cr.json",
  sim: "sim.json",
  hiring: "hiring.json",
  bbCard: "bbCard.json",
};

export const LEADERSHIP_PRINCIPLES: Record<keyof ForteSummary, string> = {
  customerObsession: "Customer Obsession",
  ownership: "Ownership",
  areRightALot: "Are Right a Lot",
  inventSimplify: "Invent & Simplify",
  learnBeCurious: "Learn & Be Curious",
  hireDevelop: "Hire & Develop the Best",
  thinkBig: "Think Big",
  insistHighestStandards: "Insist on the Highest Standards",
  biasForAction: "Bias for Action",
  frugality: "Frugality",
  earnTrust: "Earn Trust",
  diveDeep: "Dive Deep",
  backbone: "Have Backbone; Disagree & Commit",
  deliverResults: "Deliver Results",
  bestEmployer: "Strive to be Earth's Best Employer",
  successScale: "Success and Scale Bring Great Responsibility",
};
