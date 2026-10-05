import { PlusOutlined, WarningOutlined } from "@ant-design/icons";
import {
  type WeatherForecast,
  type WeatherLocation,
} from "@ncfritz/olympus-sdk/olympus";
import {
  Alert,
  Button,
  Empty,
  Result,
  Skeleton,
  Tabs,
  type TabsProps,
} from "antd";
import { useEffect, useState } from "react";
import weatherApi from "../../../api/weatherApi";
import { useAuth } from "../../../auth/AuthProvider";
import { useFetch } from "../../../hooks/useFetch";
import {
  loadFromLocalStorage,
  storeToLocalStorage,
} from "../../../utils/storage";
import { chooseLocation, formatClock } from "../../../utils/weather";
import CurrentConditions from "./CurrentConditions";
import FiveDays from "./FiveDays";
import LocationMenu from "./LocationMenu";
import ManageLocationsModal from "./ManageLocationsModal";
import RegisterStationModal from "./RegisterStationModal";
import NextHours from "./NextHours";
import StationsView from "./StationsView";
import WeatherMap from "./WeatherMap";
import styles from "./WeatherWidget.module.css";

/** The API caches forecasts for 15 minutes; asking more often gains nothing. */
const FORECAST_REFRESH_MS = 15 * 60 * 1000;

/** Which view the widget last showed, per browser. */
const VIEW_KEY = "weather.view";

type WeatherView = "forecast" | "stations";

/**
 * The home page's weather (docs/plans/weather/design.md), in two views:
 * Forecast, the signed-in user's locations one at a time, with now, the
 * next 24 hours, five days and a map, every panel following the selected
 * location; and Stations, the house's weather stations.
 */
const WeatherWidget: React.FunctionComponent = () => {
  const auth = useAuth();
  if (auth.status !== "signed-in") {
    return (
      <Frame
        view="forecast"
        forecast={
          auth.status === "loading" ? (
            <Skeleton active />
          ) : (
            <Empty description="Sign in to see the weather for your places." />
          )
        }
      />
    );
  }
  return <SignedInWeather admin={auth.user.roles.includes("admin")} />;
};

const SignedInWeather = ({ admin }: { admin: boolean }) => {
  const [view, setView] = useState<WeatherView>("forecast");
  // Read after mounting: the server render has no local storage.
  useEffect(() => {
    const stored = loadFromLocalStorage<unknown>(VIEW_KEY, "forecast");
    if (stored === "stations") setView("stations");
  }, []);
  const choose = (next: WeatherView) => {
    setView(next);
    storeToLocalStorage(VIEW_KEY, next);
  };

  // The locations live here rather than in the Forecast tab: their menu is
  // in the tab bar.
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

  // Registering a station, for an admin; the Stations tab reloads after.
  const [registering, setRegistering] = useState(false);
  const [stationsVersion, setStationsVersion] = useState(0);
  const register = admin ? () => setRegistering(true) : undefined;

  return (
    <>
      <Frame
        view={view}
        onChange={choose}
        extra={
          view === "forecast" ? (
            <LocationMenu
              locations={locations}
              selectedId={selectedId}
              onSelect={setPicked}
              onManage={() => setManaging(true)}
            />
          ) : (
            register && (
              <Button type="text" icon={<PlusOutlined />} onClick={register}>
                Register station
              </Button>
            )
          )
        }
        forecast={
          <ForecastView
            locations={locations}
            locationsLoading={locationsLoading}
            locationsError={Boolean(locationsError)}
            reloadLocations={() => void reloadLocations(false)}
            selectedId={selectedId}
            onManage={() => setManaging(true)}
          />
        }
        stations={
          <StationsView version={stationsVersion} onRegister={register} />
        }
      />
      <ManageLocationsModal
        open={managing}
        locations={locations}
        onClose={() => setManaging(false)}
        onChanged={async (added) => {
          await reloadLocations(true);
          if (added) setPicked(added.id);
        }}
      />
      {admin && (
        <RegisterStationModal
          open={registering}
          onClose={() => setRegistering(false)}
          onRegistered={() => setStationsVersion((version) => version + 1)}
        />
      )}
    </>
  );
};

const ForecastView = ({
  locations,
  locationsLoading,
  locationsError,
  reloadLocations,
  selectedId,
  onManage,
}: {
  locations: WeatherLocation[];
  locationsLoading: boolean;
  locationsError: boolean;
  reloadLocations: () => void;
  selectedId?: string;
  onManage: () => void;
}) => {
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

  return (
    <>
      {locationsLoading ? (
        <Skeleton active />
      ) : locationsError ? (
        <Result
          status="warning"
          title="Your locations could not be loaded"
          extra={<Button onClick={reloadLocations}>Retry</Button>}
        />
      ) : locations.length === 0 ? (
        <Empty description="No locations yet. Add a place to see its forecast and map.">
          <Button type="primary" onClick={onManage}>
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
        </>
      )}
    </>
  );
};

/**
 * The card: the heading on its own line, then AntD's tabs with their bar
 * on the blue rule and anything extra (the location menu) at its right.
 * A tab's content is dropped while another is shown, so Stations stops
 * polling when it is hidden.
 */
const Frame = ({
  view,
  onChange,
  extra,
  forecast,
  stations,
}: {
  view: WeatherView;
  onChange?: (view: WeatherView) => void;
  extra?: React.ReactNode;
  forecast: React.ReactNode;
  /** Signed out there is no Stations tab. */
  stations?: React.ReactNode;
}) => {
  const items: TabsProps["items"] = [
    { key: "forecast", label: "Forecast", children: forecast },
  ];
  if (stations) {
    items.push({ key: "stations", label: "Stations", children: stations });
  }
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Weather</h2>
      <Tabs
        id="weather"
        className={styles.tabs}
        activeKey={view}
        items={items}
        onChange={(key) => onChange?.(key as WeatherView)}
        tabBarExtraContent={{ right: extra || undefined }}
        destroyOnHidden
      />
    </div>
  );
};

export default WeatherWidget;
