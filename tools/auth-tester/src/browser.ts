import { spawn } from "child_process";

/**
 * Hands a URL to whatever opens links here.
 *
 * The URL is printed first and always: this runs over SSH as often as not,
 * and a tool whose only instruction is "check your browser" is no use on a
 * machine that has none.
 */
export const openInBrowser = (url: string): void => {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    // An opener that is not installed fails asynchronously, which would
    // otherwise take the process down while it waits for the redirect.
    child.on("error", () => {
      console.log(`(could not run ${command}; open the URL above yourself)`);
    });
    child.unref();
  } catch {
    console.log(`(could not run ${command}; open the URL above yourself)`);
  }
};
