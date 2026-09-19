/** A progress report parsed from HandBrakeCLI's output. */
export type HandbrakeProgress = {
  taskNumber: number;
  taskCount: number;
  percentComplete: number;
  fps: number;
  avgFps: number;
  eta: string;
  task: "Encoding" | "Muxing";
};

let last: HandbrakeProgress | null = null;

const short = {
  pattern: /\rEncoding: task (\d) of (\d), (.+) %/,
  parse: function (progressString: string) {
    const match = progressString.match(this.pattern);

    if (match) {
      const data: HandbrakeProgress = (last = {
        taskNumber: +match[1],
        taskCount: +match[2],
        percentComplete: +match[3],
        fps: 0,
        avgFps: 0,
        eta: "",
        task: "Encoding",
      });

      return data;
    }

    return undefined;
  },
};

const long = {
  pattern:
    /\rEncoding: task (\d) of (\d), (.+) % \((.+) fps, avg (.+) fps, ETA (.+)\)/,
  parse: function (progressString: string) {
    const match = progressString.match(this.pattern);

    if (match) {
      const data: HandbrakeProgress = (last = {
        taskNumber: +match[1],
        taskCount: +match[2],
        percentComplete: +match[3],
        fps: +match[4],
        avgFps: +match[5],
        eta: match[6],
        task: "Encoding",
      });

      return data;
    }

    return undefined;
  },
};

const muxing = {
  pattern: /\rMuxing: this may take awhile.../,
  parse: function (progressString: string) {
    const match = progressString.match(this.pattern);

    if (match) {
      const data: HandbrakeProgress = (last = {
        taskNumber: 0,
        taskCount: 0,
        percentComplete: 0,
        fps: 0,
        avgFps: 0,
        eta: "",
        task: "Muxing",
      });

      return data;
    }

    return undefined;
  },
};

export { long, short, muxing, last };
