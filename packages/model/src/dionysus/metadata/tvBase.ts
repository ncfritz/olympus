import {
  PartialTVSeriesCastMember,
  PartialTVSeriesCastMemberRole,
  PartialTVSeriesCrewMember,
  PartialTVSeriesCrewMemberJob,
} from "./tvSeries";

export type BaseCastCrewCredit = {
  seriesId: number;
  personId: number;
};

export type PartialTVSeriesCastMemberRoleWithKey =
  PartialTVSeriesCastMemberRole & BaseCastCrewCredit;
export type PartialTVSeriesCrewMemberJobWithKey = PartialTVSeriesCrewMemberJob &
  BaseCastCrewCredit;

export class PartialTVSeasonCastMember extends PartialTVSeriesCastMember {
  seriesId: number;
}

export class PartialTVSeasonCrewMember extends PartialTVSeriesCrewMember {
  seriesId: number;
}

export type BaseTVSeasonCastCredit = {
  seasonId: number;
};

export type PartialTVSeasonCastMemberRoleWithKey =
  PartialTVSeriesCastMemberRoleWithKey & BaseTVSeasonCastCredit;
export type PartialTVSeasonCrewMemberJobWithKey =
  PartialTVSeriesCrewMemberJobWithKey & BaseTVSeasonCastCredit;
