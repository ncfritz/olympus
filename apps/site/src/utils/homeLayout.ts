/**
 * The home page's three columns: their widths and which are collapsed,
 * kept in the browser for now (docs/plans/weather/design.md). Widths are
 * stored as percentages, so a layout saved on one window size fits another.
 */

export const HOME_LAYOUT_KEY = "home.layout";

export type HomeLayout = {
  /** Each column's width as a percentage of the row, e.g. "30%". */
  sizes: string[];
  collapsed: boolean[];
};

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  sizes: ["25%", "45%", "30%"],
  collapsed: [false, false, false],
};

const PERCENT = /^\d+(\.\d+)?%$/;

/** A stored layout, or the default for anything that is not one. */
export const parseHomeLayout = (value: unknown): HomeLayout => {
  const layout = value as Partial<HomeLayout> | null;
  const count = DEFAULT_HOME_LAYOUT.sizes.length;
  if (
    !layout ||
    !Array.isArray(layout.sizes) ||
    !Array.isArray(layout.collapsed) ||
    layout.sizes.length !== count ||
    layout.collapsed.length !== count ||
    !layout.sizes.every(
      (size) => typeof size === "string" && PERCENT.test(size),
    ) ||
    !layout.collapsed.every((flag) => typeof flag === "boolean")
  ) {
    return DEFAULT_HOME_LAYOUT;
  }
  return { sizes: layout.sizes, collapsed: layout.collapsed };
};

/**
 * The Splitter's pixel sizes as percentages of their total, to two
 * decimal places. A collapsed column is 0%.
 */
export const toPercentages = (sizes: number[]): string[] => {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (total <= 0) return DEFAULT_HOME_LAYOUT.sizes;
  return sizes.map((size) => `${Math.round((size / total) * 10_000) / 100}%`);
};
