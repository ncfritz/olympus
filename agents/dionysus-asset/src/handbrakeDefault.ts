export const DEFAULT_HANDBRAKE_CONFIG = [
  {
    Job: {
      Audio: {
        AudioList: [
          {
            Bitrate: 160,
            DRC: 0,
            Encoder: "av_aac",
            Gain: 0,
            Mixdown: 4,
            NormalizeMixLevel: false,
            Samplerate: 0,
            Name: "Stereo",
            Track: 0,
            DitherMethod: 0,
          },
          {
            Bitrate: 640,
            DRC: 0,
            Encoder: "ac3",
            Gain: 0,
            Mixdown: 7,
            NormalizeMixLevel: false,
            Samplerate: 0,
            Name: "5.1 Channels",
            Track: 0,
            DitherMethod: 0,
          },
        ],
        CopyMask: ["copy:aac", "copy:ac3"],
        FallbackEncoder: "av_aac",
      },
      Destination: {
        ChapterList: [
          {
            Name: "Chapter 1",
          },
        ],
        ChapterMarkers: true,
        AlignAVStart: true,
        File: "C:\\Users\\ncfri\\Videos\\Bigbuckbunny 640X360.mp4",
        Options: {
          IpodAtom: false,
          Optimize: false,
        },
        Mux: "av_mp4",
      },
      Filters: {
        FilterList: [
          {
            ID: 6,
            Settings: {
              mode: "7",
            },
          },
          {
            ID: 4,
            Settings: {
              "block-height": "16",
              "block-thresh": "40",
              "block-width": "16",
              "filter-mode": "2",
              mode: "3",
              "motion-thresh": "1",
              "spatial-metric": "2",
              "spatial-thresh": "1",
            },
          },
          {
            ID: 20,
            Settings: {
              "crop-bottom": "0",
              "crop-left": "0",
              "crop-right": "0",
              "crop-top": "0",
              height: "358",
              width: "640",
            },
          },
          {
            ID: 11,
            Settings: {
              mode: "0",
            },
          },
        ],
      },
      PAR: {
        Num: 1,
        Den: 1,
      },
      CoverArts: [],
      SequenceID: 0,
      Source: {
        Angle: 1,
        Range: {
          Type: "chapter",
          Start: 1,
          End: 1,
        },
        Title: 1,
        Path: "",
        HWDecode: 2,
        KeepDuplicateTitles: false,
      },
      Subtitle: {
        Search: {
          Burn: true,
          Default: false,
          Enable: true,
          Forced: true,
        },
        SubtitleList: [],
      },
      Video: {
        Encoder: "x264",
        Level: "4.0",
        MultiPass: true,
        Turbo: false,
        ColorRange: 1,
        ColorMatrixCode: 0,
        Options: "",
        Preset: "slow",
        Profile: "high",
        Quality: 20,
        HardwareDecode: 0,
      },
    },
  },
];
