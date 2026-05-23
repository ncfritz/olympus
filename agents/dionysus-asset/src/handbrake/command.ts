import childProcess from "child_process";
import { EventEmitter } from "events";
import toSpawnArgs from "object-to-spawn-args";
import path from "path";
import { HandbrakeError, HandbrakeErrorType } from "../error/handbrakeError";
import { SpawnError } from "../error/spawnError";
import * as progress from "./progress";

class HandbrakeCommand extends EventEmitter {
  private readonly options: any;
  private readonly HandbrakeCLIPath: string;
  private readonly cp: typeof childProcess;
  private handle: childProcess.ChildProcess;
  private inProgress: boolean;
  private output: string;

  constructor(options = {}) {
    super();

    this.output = "";
    this.inProgress = false;
    this.options = options;
    this.HandbrakeCLIPath = process.env.HANDBRAKE_PATH!;
    this.cp = childProcess;
  }

  cancel() {
    if (this.handle) {
      this.handle.on("close", (code, signal) => {
        if (
          /Signal 2 received, terminating/.test(this.output) ||
          (code === null && signal === "SIGINT")
        ) {
          this.emitCancelled();
        }
      });
      this.handle.kill("SIGINT");
    }
  }

  /* ensure user has had chance to attach event listeners before calling */
  run() {
    if (this.options.input !== undefined && this.options.output !== undefined) {
      const pathsEqual =
        path.resolve(this.options.input) === path.resolve(this.options.output);

      if (pathsEqual) {
        this.emitError(
          new HandbrakeError(
            HandbrakeErrorType.VALIDATION,
            "Input and output paths are the same",
          ),
        );
        return;
      }
    }

    const optionsCopy = Object.assign({}, this.options);
    /* All options except HandbrakeCLIPath should be passed into the Command command */
    delete optionsCopy.HandbrakeCLIPath;
    const spawnArgs = toSpawnArgs(optionsCopy, {
      optionEqualsValue: true,
      optionEqualsValueExclusions: [
        "preset-import-file",
        "preset-import-gui",
        "subtitle-burned",
      ],
    });
    this.emitStart();
    const handle = this.cp.spawn(this.HandbrakeCLIPath, spawnArgs);
    handle.stdout.setEncoding("utf-8");

    let buffer = "";
    handle.stdout.on("data", (chunk) => {
      buffer += chunk;

      if (progress.long.pattern.test(buffer)) {
        this.emitProgress(progress.long.parse(buffer));
        buffer = buffer.replace(progress.long.pattern, "");
      } else if (progress.short.pattern.test(buffer)) {
        this.emitProgress(progress.short.parse(buffer));
        buffer = buffer.replace(progress.short.pattern, "");
      } else if (progress.muxing.pattern.test(buffer)) {
        this.emitProgress(progress.muxing.parse(buffer));
        buffer = buffer.replace(progress.muxing.pattern, "");
      }

      this.emitOutput(chunk);
    });

    handle.stderr.setEncoding("utf-8");
    handle.stderr.on("data", this.emitStderr.bind(this));

    handle.on("exit", (code, signal) => {
      /* ignore a canceled exit, which is handled by .cancel() */
      /* the first test is for mac/linux, second for windows */
      if (
        /Signal 2 received, terminating/.test(this.output) ||
        (code === null && signal === "SIGINT")
      ) {
        return;
      }

      if (code === 0) {
        if (this.inProgress) {
          const last: any = progress.last;

          if (last) {
            last.percentComplete = 100;
            this.emitProgress(last);
          }
          this.emitEnd();
        }
      } else if (code === 1) {
        this.emitError(
          new HandbrakeError(
            HandbrakeErrorType.VALIDATION,
            `User input validation error [error code: ${code}]`,
            code,
          ),
        );
      } else if (code === 2) {
        if (/invalid preset/i.test(this.output)) {
          this.emitError(
            new HandbrakeError(
              HandbrakeErrorType.INVALID_PRESET,
              `Invalid preset [error code: ${code}]`,
              code,
            ),
          );
        } else {
          this.emitError(
            new HandbrakeError(
              HandbrakeErrorType.INVALID_INPUT,
              `Invalid input, not a video file [error code: ${code}]`,
              code,
            ),
          );
        }
      } else if (code === 3) {
        this.emitError(
          new HandbrakeError(
            HandbrakeErrorType.OTHER,
            `Handbrake InitialisationError [error code: ${code}]`,
            code,
          ),
        );
      } else if (code === 4) {
        this.emitError(
          new HandbrakeError(
            HandbrakeErrorType.OTHER,
            `Unknown Handbrake error [error code: ${code}]`,
            code,
          ),
        );
      } else if (code === null) {
        this.emitError(
          new HandbrakeError(
            HandbrakeErrorType.OTHER,
            `HandbrakeCLI crashed (Segmentation fault)`,
          ),
        );
      }
      this.emitComplete();
    });

    handle.on("error", (spawnError: SpawnError) => {
      if (spawnError.code === "ENOENT") {
        this.emitError(
          new HandbrakeError(
            HandbrakeErrorType.NOT_FOUND,
            `HandbrakeCLI application not found: ${this.HandbrakeCLIPath}`,
            spawnError.errno,
          ),
        );
      } else {
        this.emitError(
          new HandbrakeError(
            HandbrakeErrorType.OTHER,
            spawnError.message,
            spawnError.errno,
          ),
        );
      }
      this.emitComplete();
    });

    this.handle = handle;
  }

  emitStart() {
    this.emit("start");
  }

  emitBegin() {
    this.inProgress = true;
    this.emit("begin");
  }

  emitProgress(progress: any) {
    if (!this.inProgress) {
      this.emitBegin();
    }

    this.emit("progress", progress);
  }

  emitOutput(output: string) {
    this.output += output;

    if (/unknown option/.test(output.toString())) {
      this.emitError(
        new HandbrakeError(
          HandbrakeErrorType.OTHER,
          `HandbrakeCLI reported "unknown option", please report this issue: https://github.com/75lb/handbrake-js/issues/new`,
        ),
      );
    } else {
      this.emit("output", output);
    }
  }

  emitStderr(output: string) {
    this.emit("stderr", output);
  }

  emitError(err: HandbrakeError) {
    err.output = this.output;
    err.options = this.options;
    this.emit("error", err);
  }

  emitEnd() {
    this.emit("end");
  }

  emitComplete() {
    this.emit("complete");
  }

  emitCancelled() {
    this.emit("cancelled");
  }
}

export default HandbrakeCommand;
