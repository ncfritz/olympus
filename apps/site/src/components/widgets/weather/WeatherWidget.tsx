import { WarningOutlined } from "@ant-design/icons";
import {
  type WeatherForecast,
  type WeatherLocation,
} from "@ncfritz/olympus-sdk/olympus";
import { Alert, Button, Empty, Result, Skeleton } from "antd";
import { useEffect, useState } from "react";
import weatherApi from "../../../api/weatherApi";
import { useAuth } from "../../../auth/AuthProvider";
import { useFetch } from "../../../hooks/useFetch";
import { chooseLocation, formatClock } from "../../../utils/weather";
import CurrentConditions from "./CurrentConditions";
import FiveDays from "./FiveDays";
import LocationMenu from "./LocationMenu";
import ManageLocationsModal from "./ManageLocationsModal";
import NextHours from "./NextHours";
import WeatherMap from "./WeatherMap";
import styles from "./WeatherWidget.module.css";

/** The API caches forecasts for 15 minutes; asking more often gains nothing. */
const FORECAST_REFRESH_MS = 15 * 60 * 1000;

/**
 * The home page's weather (docs/plans/weather/design.md): the signed-in
 * user's locations, one at a time, with now, the next 24 hours, five days
 * and a map. Every panel follows the one selected location.
 */
const WeatherWidget: React.FunctionComponent = () => {
  const auth = useAuth();
  if (auth.status !== "signed-in") {
    return (
      <Frame>
        {auth.status === "loading" ? (
          <Skeleton active />
        ) : (
          <Empty description="Sign in to see the weather for your places." />
        )}
      </Frame>
    );
  }
  return <SignedInWeather />;
};

const SignedInWeather: React.FunctionComponent = () => {
  const [picked, setPicked] = useState<string | undefined>();
  const [managing, setManaging] = useState(false);

  const [locations, locationsLoading, locationsError, reloadLocations] =
    useFetch<Record<string, never>, WeatherLocation[]>({
      params: {},
      default: [],
      fetchFunction: () => weatherApi.listLocations(),
      dataType: "weather locations",
    });

  const selectedId = chooseLocation(locations, picked);
  const selected = locations.find((location) => location.id === selectedId);

  const [
    forecast,
    forecastLoading,
    forecastError,
    refetchForecast,
    setForecast,
  ] = useFetch<{ locationId?: string }, WeatherForecast | undefined>({
    params: { locationId: selectedId },
    default: undefined,
    validateOptions: (params) => params.locationId !== undefined,
    fetchFunction: ({ locationId }) => weatherApi.describeForecast(locationId!),
    dataType: "forecast",
    watch: [selectedId],
  });

  // A forecast for the location on screen, never the previous one.
  const shown =
    forecast && forecast.locationId === selectedId ? forecast : undefined;

  useEffect(() => {
    if (selectedId === undefined) setForecast(undefined);
    const timer = setInterval(() => {
      if (selectedId !== undefined && document.visibilityState === "visible") {
        void refetchForecast(true);
      }
    }, FORECAST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [selectedId]);

  const header = (
    <LocationMenu
      locations={locations}
      selectedId={selectedId}
      onSelect={setPicked}
      onManage={() => setManaging(true)}
    />
  );

  return (
    <Frame extra={header}>
      {locationsLoading ? (
        <Skeleton active />
      ) : locationsError ? (
        <Result
          status="warning"
          title="Your locations could not be loaded"
          extra={
            <Button onClick={() => void reloadLocations(false)}>Retry</Button>
          }
        />
      ) : locations.length === 0 ? (
        <Empty description="No locations yet. Add a place to see its forecast and map.">
          <Button type="primary" onClick={() => setManaging(true)}>
            Add a location
          </Button>
        </Empty>
      ) : (
        <>
          {shown?.stale && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message={`Showing the forecast from ${formatClock(shown.fetchedTime, shown.utcOffsetSeconds)}. OpenWeather isn't answering; the server keeps retrying.`}
            />
          )}
          {shown ? (
            <>
              <CurrentConditions
                current={shown.current}
                utcOffsetSeconds={shown.utcOffsetSeconds}
                fetchedTime={shown.fetchedTime}
              />
              <NextHours
                steps={shown.next}
                utcOffsetSeconds={shown.utcOffsetSeconds}
              />
              <FiveDays days={shown.days} />
            </>
          ) : forecastLoading || !forecastError ? (
            <Skeleton active />
          ) : (
            <Result
              status="warning"
              title="No forecast right now"
              subTitle="The weather provider isn't answering and there is no recent forecast to show."
              extra={
                <Button onClick={() => void refetchForecast(false)}>
                  Retry
                </Button>
              }
            />
          )}
          {selected && (
            <WeatherMap
              center={{ lat: selected.latitude, lng: selected.longitude }}
              utcOffsetSeconds={shown?.utcOffsetSeconds ?? 0}
            />
          )}
          <div className={styles.attribution}>
            Forecast and map layers ©{" "}
            <a
              href="https://openweathermap.org"
              target="_blank"
              rel="noreferrer"
            >
              OpenWeather
            </a>{" "}
            · Radar ©{" "}
            <a
              href="https://www.rainviewer.com"
              target="_blank"
              rel="noreferrer"
            >
              RainViewer
            </a>
          </div>
        </>
      )}
      <ManageLocationsModal
        open={managing}
        locations={locations}
        onClose={() => setManaging(false)}
        onChanged={async (added) => {
          await reloadLocations(true);
          if (added) setPicked(added.id);
        }}
      />
    </Frame>
  );
};

const Frame = ({
  extra,
  children,
}: {
  extra?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className={styles.card}>
    <div className={styles.header}>
      <h2 className={styles.title}>Weather</h2>
      {extra}
    </div>
    {children}
  </div>
);

export default WeatherWidget;
