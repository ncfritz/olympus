export const Colors = {
  DND: "#990000",
  INTERRUPT: "#ffcc00",
  FREE: "#009900",
  CLEAR: "#dddddd",
};

export const getColorForStatus = (status: string) => {
  switch (status) {
    case "dnd":
      return Colors.DND;
    case "interrupt":
      return Colors.INTERRUPT;
    case "free":
      return Colors.FREE;
    default:
      return Colors.CLEAR;
  }
};
