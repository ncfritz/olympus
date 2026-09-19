import * as util from "node:util";
import HandbrakeCommand from "./command";
import { HandbrakeError, HandbrakeErrorType } from "../error/handbrakeError";
import toSpawnArgs from "object-to-spawn-args";
import cp from "child_process";

const spawn = (options = {}) => {
  const handbrake = new HandbrakeCommand(options);

  process.nextTick(function () {
    try {
      handbrake.run();
    } catch (e) {
      handbrake.emitError(
        new HandbrakeError(HandbrakeErrorType.VALIDATION, e.message),
      );
    }
  });

  return handbrake;
};

const exec = (
  options = {},
  done: (
    error: cp.ExecException | null,
    stdout: string,
    stderr: string,
  ) => void,
) => {
  const handbrakePath = process.env.HANDBRAKE_PATH!;
  const optionsCopy = Object.assign({}, options);

  // @ts-expect-error no types here
  delete optionsCopy.HandbrakeCLIPath;

  const cmd = util.format(
    '"%s" %s',
    handbrakePath,
    toSpawnArgs(optionsCopy, { quote: true }).join(" "),
  );
  cp.exec(cmd, done);
};

const run = async (options: any) => {
  return new Promise((resolve, reject) => {
    exec(options, function (err, stdout, stderr) {
      if (err) {
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

const Handbrake = { spawn, exec, run };
export default Handbrake;
