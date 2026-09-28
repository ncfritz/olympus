export const MeetingStatusTypes = [
  "Free",
  "Busy",
  "Tentative",
  "OOF",
  "WorkingElsewhere",
  "NoData",
];

export const config: Record<string, Record<string, any>> = {
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
