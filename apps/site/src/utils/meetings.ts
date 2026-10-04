export const MeetingStatusTypes = [
  "Free",
  "Busy",
  "Tentative",
  "OOF",
  "WorkingElsewhere",
  "NoData",
] as const;

/** The statuses above, as the keys of MeetingStatusStatistics. */
export type MeetingStatusType = (typeof MeetingStatusTypes)[number];

export const config: Record<string, { color: string }> = {
  Free: {
    color: "#32485c",
  },
  Busy: {
    color: "#67598c",
  },
  Tentative: {
    color: "#c05a91",
  },
  OOF: {
    color: "#df5b84",
  },
  WorkingElsewhere: {
    color: "#ff7356",
  },
  NoData: {
    color: "#ffa600",
  },
};

export const getColorForType = (type: string) => {
  return config[type].color;
};

/** Where an organizer's photo lives, by alias: the work directory's. */
const AVATAR_BASE = "https://cdn.internal.ncfritz.net/amzn/avatar";

/** Who organized a meeting, as far as Minerva knows them. */
export interface MeetingOrganizer {
  /** A name to show: theirs when known, else their address. */
  name: string;
  email?: string;
  /** A photo, when Minerva knows their alias. */
  avatar?: string;
}

/**
 * A meeting's organizer for display. A meeting synced from a calendar
 * names its organizer by address only, and some name none at all.
 */
export const organizerOf = (meeting: {
  organizer?: {
    email: string;
    alias?: string;
    givenName?: string;
    surname?: string;
  };
  organizerEmail?: string;
}): MeetingOrganizer => {
  const person = meeting.organizer;
  const email = person?.email || meeting.organizerEmail || undefined;
  const name = [person?.givenName, person?.surname]
    .filter((part) => part && part.trim() !== "")
    .join(" ");
  return {
    name: name || email || "Unknown organizer",
    email,
    avatar: person?.alias ? `${AVATAR_BASE}/${person.alias}.jpg` : undefined,
  };
};
