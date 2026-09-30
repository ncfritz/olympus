/**
 * `pnpm weather:replay` — loads a range of the raw station archive into an
 * environment's tables (ADR 0024, 0025).
 *
 *   pnpm --filter @ncfritz/olympus-api build
 *   pnpm --filter @ncfritz/olympus-api weather:replay 2026-09-01 2026-09-29
 *   pnpm --filter @ncfritz/olympus-api weather:replay 2026-09-29 2026-09-29 \
 *     --dir /Volumes/Weather --station A0:B1:C2:D3:E4:F5 --replace
 *
 * The environment is the env file the script names (dev.env: olympus_dev
 * through hasura-dev). The archive is WEATHER_ARCHIVE_DIR unless --dir
 * names another: prod's on the Mac Mini, or the NAS copy. The API's
 * ReplayWeatherArchive does the same against its own archive only.
 *
 * Like auth:user, it talks to Hasura with the admin secret, which is why it
 * lives in this package.
 */
import "source-map-support/register";

import { GraphQLClient } from "graphql-request";
import { readConfig } from "./config/configuration";
import { normalizeMac } from "./olympus/weather/stations/ambientReport";
import { parseDay } from "./olympus/weather/stations/archiveReader";
import { WeatherIngestService } from "./olympus/weather/services/WeatherIngestService";
import { WeatherReplayService } from "./olympus/weather/services/WeatherReplayService";
import { WeatherRollupService } from "./olympus/weather/services/WeatherRollupService";
import { WeatherStationService } from "./olympus/weather/services/WeatherStationService";

const USAGE = `Usage: weather:replay <from> <to> [--dir <archive>] [--station <mac>] [--replace]

  <from> <to>        UTC days, YYYY-MM-DD, both included
  --dir <archive>    the archive to read (default WEATHER_ARCHIVE_DIR)
  --station <mac>    one station only (default every station in the archive)
  --replace          overwrite readings already stored (after a parser fix);
                     by default they are kept

Stations are matched by MAC against this environment's registered stations;
lines from a station it does not know are counted and skipped.`;

class UsageError extends Error {}

const parseArgs = (argv: string[]) => {
  const positional: string[] = [];
  let dir: string | undefined;
  let station: string | undefined;
  let replace = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") dir = argv[++i];
    else if (arg === "--station") station = argv[++i];
    else if (arg === "--replace") replace = true;
    else if (arg.startsWith("--"))
      throw new UsageError(`unknown option ${arg}`);
    else positional.push(arg);
  }
  const from = parseDay(positional[0]);
  const to = parseDay(positional[1]);
  if (!from || !to || positional.length !== 2) {
    throw new UsageError("<from> and <to> are required, as YYYY-MM-DD");
  }
  if (to.isBefore(from)) throw new UsageError("<to> is before <from>");
  if (argv.includes("--dir") && !dir) {
    throw new UsageError("--dir needs a directory");
  }
  if (argv.includes("--station") && !station) {
    throw new UsageError("--station needs a MAC address");
  }
  const macAddress = station === undefined ? undefined : normalizeMac(station);
  if (station !== undefined && !macAddress) {
    throw new UsageError(`--station ${station} is not a MAC address`);
  }
  return { from, to, dir, macAddress, replace };
};

async function run(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return;
  }
  const args = parseArgs(argv);
  const config = readConfig(process.env);
  if (config.hasura.adminSecret === "") {
    throw new UsageError(
      "HASURA_PASSWORD (or HASURA_PASSWORD_FILE) is not set, so every query would be refused",
    );
  }
  const client = new GraphQLClient(config.hasura.endpoint, {
    headers: {
      "content-type": "application/json",
      "x-hasura-admin-secret": config.hasura.adminSecret,
    },
  });
  const rollups = new WeatherRollupService(client);
  const replays = new WeatherReplayService(
    new WeatherIngestService(
      client,
      new WeatherStationService(client, config.weather),
    ),
    rollups,
    config.weather,
  );
  const summary = await replays.replay(
    {
      from: args.from,
      to: args.to,
      macAddress: args.macAddress,
      mode: args.replace ? "replace" : "ignore",
      dir: args.dir,
    },
    (day, so) =>
      console.log(
        `${day}: ${so.counts.stored} stored, ${so.counts.duplicate} duplicate so far`,
      ),
  );
  console.log(JSON.stringify(summary, null, 2));
}

run(process.argv.slice(2)).then(
  () => process.exit(0),
  (error: unknown) => {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n\n${USAGE}`);
      process.exit(2);
    }
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
