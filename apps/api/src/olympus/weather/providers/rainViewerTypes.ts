/** RainViewer's Weather Maps API index, as far as the API reads it. */
export type RainViewerFrame = { time: number; path: string };

export type RainViewerMaps = {
  version: string;
  generated: number;
  host: string;
  radar: { past: RainViewerFrame[]; nowcast?: RainViewerFrame[] };
};
