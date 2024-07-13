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
  notes: boolean;
  mentorship: boolean;
  code: boolean;
  cr: boolean;
  tt: boolean;
  sim: boolean;
  hiring: boolean;
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
  date: string;
  changes: number;
  added: number;
  removed: number;
  packages: number;
};

export type CRStat = {
  date: string;
  authored: number;
  commented: number;
  received: number;
  approved: number;
};

export const DATA_PATHS: Record<keyof UserDataSummary, string> = {
  jobInfo: "jobInfo.json",
  performance: "rating.json",
  jobHistory: "jobHistory.json",
  notes: "notes.json",
  mentorship: "mentorship.json",
  code: "code.json",
  cr: "cr.json",
  tt: "tt.json",
  sim: "sim.json",
  hiring: "hiring.json",
};