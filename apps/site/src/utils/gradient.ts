const percentColors = [
  { pct: 0.0, color: { r: 71, g: 129, b: 51 } },
  { pct: 0.5, color: { r: 197, g: 152, b: 28 } },
  { pct: 1.0, color: { r: 125, g: 0, b: 0 } },
];

export const getGradientAtPercent = (percent: number) => {
  if (percent > 1) {
    percent = 1.0;
  }

  let mapIndex = 1;

  for (let i = 1; i < percentColors.length - 1; i++) {
    if (percent < percentColors[i].pct) {
      mapIndex = i;
      break;
    }
  }

  const lower = percentColors[mapIndex - 1];
  const upper = percentColors[mapIndex];
  const range = upper.pct - lower.pct;
  const rangePct = (percent - lower.pct) / range;
  const pctLower = 1 - rangePct;
  const pctUpper = rangePct;
  const color = {
    r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
    g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
    b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper),
  };

  return "rgba(" + [color.r, color.g, color.b].join(",") + ", 1.0)";
};
