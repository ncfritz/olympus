/**
 * transcodeMetadata.json: the tracks and geometry of a transcode, written
 * when the configuration is chosen (partially) and approved (fully).
 */
export type TranscodeMetadata = {
  mediaExtension: string;
  videoTrackIndex: number;
  audioTrackIndex: number;
  subtitleTrackIndex?: number;
  verify?: boolean;
  originalWidth?: number;
  originalHeight?: number;
  width?: number;
  height: number;
  /** Seconds. */
  duration: number;
  /** Bytes of the original. */
  size: number;
};

/** The parts of ffprobe output (metadata.json) the agent reads. */
export type ProbedMetadata = {
  streams: {
    codec_type?: string;
    width?: number;
    height?: number;
    /** Seconds. */
    duration?: number | string;
  }[];
};
