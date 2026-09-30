import { type WeatherStation } from "@ncfritz/olympus-sdk/olympus";
import { Alert, Button, Empty, Result, Skeleton } from "antd";
import { useEffect, useState } from "react";
import weatherApi from "../../../api/weatherApi";
import StationCard from "./StationCard";
import styles from "./WeatherWidget.module.css";

/** The consoles push every ~16 seconds; a minute keeps the card current. */
const REFRESH_MS = 60 * 1000;
/** How often "12 s ago" moves on between refreshes. */
const TICK_MS = 10 * 1000;

/**
 * The house's stations (plan phase 8): each station's newest reading,
 * refreshed every minute while the page is visible. A refresh that fails
 * keeps what is on screen and says so, rather than notifying every minute.
 * With none registered, an admin is offered registering one.
 */
export interface StationsViewProps {
  /** Changes when a station is registered, to load the list again. */
  version?: number;
  /** Opens registering a station; only an admin has it. */
  onRegister?: () => void;
}

const StationsView: React.FunctionComponent<StationsViewProps> = ({
  version,
  onRegister,
}: StationsViewProps) => {
  const [stations, setStations] = useState<WeatherStation[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = async () => {
    try {
      setStations(await weatherApi.listStations());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setNow(Date.now());
    }
  };

  useEffect(() => {
    if (version) void load();
  }, [version]);

  useEffect(() => {
    void load();
    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, []);

  if (stations === undefined) {
    return failed ? (
      <Result
        status="warning"
        title="The stations could not be loaded"
        extra={<Button onClick={() => void load()}>Retry</Button>}
      />
    ) : (
      <Skeleton active />
    );
  }
  if (stations.length === 0) {
    return onRegister ? (
      <Empty description="No stations registered yet.">
        <Button type="primary" onClick={onRegister}>
          Register a station
        </Button>
      </Empty>
    ) : (
      <Empty description="No stations registered yet. An admin registers them." />
    );
  }
  return (
    <>
      {failed && (
        <Alert
          type="warning"
          showIcon
          message="The stations could not be refreshed; showing the last readings."
        />
      )}
      {stations.map((station) => (
        <StationCard key={station.id} station={station} now={now} />
      ))}
      <div className={styles.attribution}>
        Ambient Weather WS-5000 · readings pushed over the LAN every ~16 s
      </div>
    </>
  );
};

export default StationsView;
