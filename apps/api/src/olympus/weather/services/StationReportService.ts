import { BlockList, isIP } from "node:net";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import moment from "moment";
import {
  weatherConfig,
  type WeatherConfigType,
} from "../../../config/configuration";
import { normalizeMac } from "../stations/ambientReport";
import { type ArchiveLine, StationArchive } from "../stations/StationArchive";
import { recordStationReport } from "../weatherMetrics";
import { WeatherIngestService } from "./WeatherIngestService";
import { WeatherStationService } from "./WeatherStationService";

/** How often a refused station or address is logged, per key. */
const LOG_EVERY_MS = 60 * 60 * 1000;

export type StationPush = {
  /** The query as Express parsed it. */
  query: Record<string, unknown>;
  /** The query string exactly as received, for the archive. */
  rawQuery: string;
  /** The caller's address, from the forwarded chain (TRUSTED_PROXIES). */
  remoteAddress: string | undefined;
};

/**
 * A WS-5000's Customized upload (ADR 0024, plan phase 5).
 *
 * In order: the push must come from `WEATHER_STATION_ALLOWED_CIDRS`; its
 * PASSKEY must be a registered station's MAC; it is archived as received;
 * then it goes the way every archive line goes (WeatherIngestService). A
 * repeat of a stored reading is ignored. A push that fails to parse is
 * still in the archive, so a parser fix can replay it.
 */
@Injectable()
export class StationReportService {
  private readonly logger = new Logger(StationReportService.name);
  private readonly allowed = new BlockList();
  private readonly lastLogged = new Map<string, number>();

  constructor(
    private readonly stations: WeatherStationService,
    private readonly archive: StationArchive,
    private readonly ingest: WeatherIngestService,
    @Inject(weatherConfig.KEY) weather: WeatherConfigType,
  ) {
    for (const cidr of weather.stations.allowedCidrs) {
      const [address, prefix] = cidr.split("/");
      const family = isIP(address) === 6 ? "ipv6" : "ipv4";
      if (prefix === undefined) this.allowed.addAddress(address, family);
      else this.allowed.addSubnet(address, Number(prefix), family);
    }
  }

  /** Stores a push, and says whether it was new. */
  async report(push: StationPush): Promise<"stored" | "duplicate"> {
    const receivedAt = moment.utc();
    const remote = unmapped(push.remoteAddress);
    if (!remote || !this.isAllowed(remote)) {
      recordStationReport("refused_address");
      this.logOnce(
        `address:${remote}`,
        `Refused a station push from ${remote ?? "an unknown address"}: not in WEATHER_STATION_ALLOWED_CIDRS`,
      );
      throw new ForbiddenException();
    }

    const macAddress = normalizeMac(firstString(push.query.PASSKEY));
    const station = macAddress
      ? await this.stations.findByMac(macAddress)
      : undefined;
    if (!macAddress || !station) {
      recordStationReport("refused_station");
      this.logOnce(
        `mac:${macAddress}`,
        `Refused a station push from ${remote}: ${macAddress ?? "no PASSKEY"} is not a registered station`,
      );
      throw new ForbiddenException();
    }

    const line: ArchiveLine = {
      receivedAt: receivedAt.toISOString(),
      source: "push",
      remote,
      query: push.rawQuery,
    };
    await this.archive.append(macAddress, line);

    // Archived first, so a push that fails to parse can be replayed once
    // the parser is fixed.
    const { counts, errors } = await this.ingest.ingest([{ macAddress, line }]);
    if (counts.invalid > 0) {
      recordStationReport("invalid");
      throw new BadRequestException(errors[0]);
    }
    const outcome = counts.stored > 0 ? "stored" : "duplicate";
    recordStationReport(outcome);
    return outcome;
  }

  private isAllowed(address: string): boolean {
    return this.allowed.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
  }

  /** Once an hour per key at warn; never the query, which is a whole push. */
  private logOnce(key: string, message: string) {
    const last = this.lastLogged.get(key) ?? 0;
    if (Date.now() - last >= LOG_EVERY_MS) {
      this.lastLogged.set(key, Date.now());
      this.logger.warn(message);
    }
  }
}

/** `::ffff:192.168.15.20`, as Node reports an IPv4 peer, as `192.168.15.20`. */
const unmapped = (address: string | undefined) =>
  address?.startsWith("::ffff:") ? address.slice(7) : address;

const firstString = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : undefined;
};
