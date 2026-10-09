/**
 * Shape of the ffprobe JSON we publish to the CDN alongside each media asset.
 *
 * This is not generated from the API spec: the files are written by the media
 * pipeline straight from `ffprobe -print_format json`, so the contract is
 * ffprobe's output, not ours. Only the fields the UI reads are declared, and
 * nearly everything is optional because ffprobe emits a different subset per
 * codec and stream type. Numeric fields that ffprobe renders as strings
 * (durations, sizes, bit rates) are declared as strings, which is what they
 * are in the JSON.
 */

/** Stream flags; ffprobe writes these as 0 or 1. */
export interface FFProbeDisposition {
  default?: number;
  dub?: number;
  original?: number;
  comment?: number;
  lyrics?: number;
  karaoke?: number;
  forced?: number;
  hearing_impaired?: number;
  visual_impaired?: number;
  clean_effects?: number;
  attached_pic?: number;
  timed_thumbnails?: number;
  captions?: number;
  descriptions?: number;
  metadata?: number;
  dependent?: number;
  still_image?: number;
}

export interface FFProbeStream {
  index: number;
  codec_type?: string;
  codec_name?: string;
  codec_long_name?: string;
  codec_tag?: string;
  codec_tag_string?: string;
  profile?: string;
  level?: number;
  id?: string;

  // Video
  width?: number;
  height?: number;
  coded_width?: number;
  coded_height?: number;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  pix_fmt?: string;
  has_b_frames?: number;
  refs?: number;
  is_avc?: string;
  nal_length_size?: string;
  color_range?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  chroma_location?: string;
  field_order?: string;
  closed_captions?: number;
  film_grain?: number;

  // Audio
  sample_fmt?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bits_per_sample?: number;
  bits_per_raw_sample?: string;

  // Timing and rates
  r_frame_rate?: string;
  avg_frame_rate?: string;
  time_base?: string;
  start_pts?: number;
  start_time?: string;
  duration_ts?: number;
  duration?: string;
  bit_rate?: string;
  max_bit_rate?: string;

  extradata_size?: number;
  /** ffprobe emits this for every stream. */
  disposition: FFProbeDisposition;
  tags?: Record<string, string>;
}

export interface FFProbeFormat {
  filename?: string;
  nb_streams?: number;
  nb_stream_groups?: number;
  nb_programs?: number;
  format_name?: string;
  format_long_name?: string;
  start_time?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  probe_score?: number;
  tags?: Record<string, string>;
}

export interface FFProbeChapter {
  id?: number;
  time_base?: string;
  start?: number;
  start_time?: string;
  end?: number;
  end_time?: string;
  tags?: Record<string, string>;
}

export interface FFProbeMetadata {
  format: FFProbeFormat;
  streams?: FFProbeStream[];
  chapters?: FFProbeChapter[];
}
