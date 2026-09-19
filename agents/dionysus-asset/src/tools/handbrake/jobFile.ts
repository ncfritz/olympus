/**
 * A HandBrake queue file (`--queue-import-file`), trimmed to the settings
 * the transcode planning changes; the rest passes through.
 */
export type HandbrakeJobFile = {
  Job: {
    Source: {
      Path?: string;
      Title?: number;
      Range?: { Type: "time"; Start: number; End: number };
    } & Record<string, unknown>;
    Destination: { File?: string } & Record<string, unknown>;
    Filters: {
      FilterList: { ID: number; Settings: Record<string, unknown> }[];
    } & Record<string, unknown>;
    Audio: {
      AudioList: ({ Track: number } & Record<string, unknown>)[];
    } & Record<string, unknown>;
    Subtitle: {
      SubtitleList: Record<string, unknown>[];
      Search?: Record<string, unknown>;
    } & Record<string, unknown>;
  } & Record<string, unknown>;
}[];

/** Sets the scale filter (ID 20) of a job to width × height. */
export const setResolution = (
  job: HandbrakeJobFile,
  width: number,
  height: number,
): void => {
  const resIndex = job[0].Job.Filters.FilterList.findIndex(
    (filter) => filter.ID === 20,
  );

  if (resIndex > -1) {
    job[0].Job.Filters.FilterList[resIndex].Settings.width = `${width}`;
    job[0].Job.Filters.FilterList[resIndex].Settings.height = `${height}`;
  }
};
