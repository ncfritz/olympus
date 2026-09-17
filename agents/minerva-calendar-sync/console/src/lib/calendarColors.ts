/** A generic categorical palette (AntD-ish hues), not tied to any particular status meaning. */
const PALETTE = [
  "#1677ff",
  "#52c41a",
  "#fa8c16",
  "#eb2f96",
  "#722ed1",
  "#13c2c2",
  "#a0d911",
  "#f5222d",
  "#2f54eb",
  "#fa541c",
];

/** Deterministic so a calendar gets a stable default color before the user ever picks one, and the same one again if their customization is ever lost. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function defaultColorFor(source: string): string {
  return PALETTE[hashString(source) % PALETTE.length];
}
