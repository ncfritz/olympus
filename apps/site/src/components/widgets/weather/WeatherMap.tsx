import { PauseOutlined, CaretRightOutlined } from "@ant-design/icons";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer } from "@deck.gl/layers";
import {
  type RadarFrame,
  type WeatherMapLayer,
} from "@ncfritz/olympus-sdk/olympus";
import { Map } from "@vis.gl/react-google-maps";
import { Button, Flex, Segmented, Slider } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import weatherApi from "../../../api/weatherApi";
import { useFetch } from "../../../hooks/useFetch";
import { STYLE_SHIFT_WORKER } from "../../../utils/maps";
import { formatClock, nextFrame } from "../../../utils/weather";
import { WeatherMapOverlay } from "./WeatherMapOverlay";
import styles from "./WeatherWidget.module.css";

export interface WeatherMapProps {
  center: { lat: number; lng: number };
  /** The location's offset, for the radar frames' times. */
  utcOffsetSeconds: number;
}

type MapLayerChoice = "radar" | WeatherMapLayer;

/** Fixed (ADR 0024): radar is drawn from zoom-7 tiles, one level up. */
const ZOOM = 8;
const RADAR_MAX_ZOOM = 7;
const LAYER_OPACITY = 0.6;
const FRAME_MS = 500;
const FRAMES_REFRESH_MS = 10 * 60 * 1000;

const CHOICES: { value: MapLayerChoice; label: string }[] = [
  { value: "radar", label: "Radar" },
  { value: "precipitation", label: "Precip" },
  { value: "temperature", label: "Temp" },
  { value: "clouds", label: "Clouds" },
  { value: "wind", label: "Wind" },
  { value: "pressure", label: "Pressure" },
];

const LEGEND = ["#95de64", "#52c41a", "#fadb14", "#fa8c16", "#f5222d"];

type TileRequest = {
  index: { x: number; y: number; z: number };
  signal?: AbortSignal;
};

/**
 * The Google map at a fixed zoom with one weather layer over it, drawn by
 * deck.gl from tiles the API proxies (so they carry the user's token and no
 * provider key). Radar keeps a layer per frame, all loaded, only the current
 * one visible, so playback never waits on the network.
 */
const WeatherMap: React.FunctionComponent<WeatherMapProps> = ({
  center,
  utcOffsetSeconds,
}: WeatherMapProps) => {
  const [choice, setChoice] = useState<MapLayerChoice>("radar");
  const [failing, setFailing] = useState(false);
  const [frameIndex, setFrameIndex] = useState<number | undefined>();
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  const [frames, , framesError, refetchFrames] = useFetch<
    Record<string, never>,
    RadarFrame[]
  >({
    params: {},
    default: [],
    fetchFunction: () => weatherApi.listRadarFrames(),
    dataType: "radar frames",
  });

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refetchFrames(true);
    }, FRAMES_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // New frames: show the latest, and forget what was loaded for old ones.
  useEffect(() => {
    setFrameIndex(frames.length > 0 ? frames.length - 1 : undefined);
    setLoaded((previous) => {
      const ids = new Set(frames.map((frame) => frame.id));
      return new Set([...previous].filter((id) => ids.has(id)));
    });
  }, [frames]);

  useEffect(() => setFailing(false), [choice]);

  const allLoaded = frames.length > 0 && loaded.size >= frames.length;

  useEffect(() => {
    if (!playing || !allLoaded) return;
    const timer = setInterval(
      () => setFrameIndex((index) => nextFrame(index ?? 0, frames.length)),
      FRAME_MS,
    );
    return () => clearInterval(timer);
  }, [playing, allLoaded, frames.length]);

  // One tile fetcher per frame, kept stable so deck.gl never refetches a
  // layer just because this component rendered again.
  const fetchers = useRef(
    new globalThis.Map<
      string,
      (request: TileRequest) => Promise<ImageBitmap | null>
    >(),
  );
  const radarFetcher = useCallback((frameId: string) => {
    let fetcher = fetchers.current.get(frameId);
    if (!fetcher) {
      fetcher = ({ index: { x, y, z }, signal }) =>
        decode(weatherApi.radarTile(frameId, z, x, y, signal), () =>
          setFailing(true),
        );
      fetchers.current.set(frameId, fetcher);
    }
    return fetcher;
  }, []);

  const layerFetcher = useMemo(
    () =>
      choice === "radar"
        ? undefined
        : ({ index: { x, y, z }, signal }: TileRequest) =>
            decode(weatherApi.mapTile(choice, z, x, y, signal), () =>
              setFailing(true),
            ),
    [choice],
  );

  const layers = useMemo(() => {
    if (choice !== "radar") {
      return [tileLayer(`layer-${choice}`, layerFetcher!, 10, LAYER_OPACITY)];
    }
    return frames.map((frame, index) =>
      tileLayer(
        `radar-${frame.id}`,
        radarFetcher(frame.id),
        RADAR_MAX_ZOOM,
        index === frameIndex ? LAYER_OPACITY : 0,
        () =>
          setLoaded((previous) =>
            previous.has(frame.id) ? previous : new Set(previous).add(frame.id),
          ),
      ),
    );
  }, [choice, frames, frameIndex, layerFetcher, radarFetcher]);

  const frame = frameIndex !== undefined ? frames[frameIndex] : undefined;
  const radarUnavailable = choice === "radar" && framesError !== undefined;

  return (
    <section className={styles.section} aria-label="Map">
      <div className={styles.map}>
        <Map
          center={center}
          zoom={ZOOM}
          styles={STYLE_SHIFT_WORKER}
          gestureHandling="none"
          disableDefaultUI
          keyboardShortcuts={false}
          clickableIcons={false}
        >
          <WeatherMapOverlay layers={layers} />
        </Map>
        {(failing || radarUnavailable) && (
          <span className={styles.mapNote} role="status">
            {choice === "radar" ? "Radar" : "This layer"} is unavailable right
            now; the base map still shows.
          </span>
        )}
      </div>

      <Segmented<MapLayerChoice>
        block
        size="small"
        aria-label="Map layer"
        options={CHOICES}
        value={choice}
        onChange={(value) => {
          setPlaying(false);
          setChoice(value);
        }}
      />

      {choice === "radar" && frames.length > 0 && (
        <>
          <div className={styles.timeline}>
            <Button
              shape="circle"
              aria-label={playing ? "Pause radar loop" : "Play radar loop"}
              icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
              loading={playing && !allLoaded}
              onClick={() => setPlaying((value) => !value)}
            />
            <Flex vertical flex={1}>
              <Slider
                min={0}
                max={frames.length - 1}
                value={frameIndex}
                tooltip={{
                  formatter: (value) =>
                    value !== undefined && frames[value]
                      ? formatClock(frames[value].time, utcOffsetSeconds)
                      : "",
                }}
                aria-label="Radar frame"
                onChange={(value) => {
                  setPlaying(false);
                  setFrameIndex(value);
                }}
              />
              <Flex justify="space-between" className={styles.muted}>
                <span>{formatClock(frames[0].time, utcOffsetSeconds)}</span>
                <span>
                  {frame ? formatClock(frame.time, utcOffsetSeconds) : ""}
                </span>
                <span>
                  {formatClock(
                    frames[frames.length - 1].time,
                    utcOffsetSeconds,
                  )}
                </span>
              </Flex>
            </Flex>
          </div>
          <div className={styles.legend} aria-label="Radar intensity">
            <span>Light</span>
            {LEGEND.map((color) => (
              <span
                key={color}
                className={styles.swatch}
                // A legend swatch is its colour; there is nothing else to it.
                style={{ background: color }}
              />
            ))}
            <span>Heavy</span>
          </div>
        </>
      )}
    </section>
  );
};

/** A tile blob as an image deck.gl can draw; a failure is a gap, not a crash. */
const decode = async (
  tile: Promise<Blob>,
  onFailure: () => void,
): Promise<ImageBitmap | null> => {
  try {
    return await createImageBitmap(await tile);
  } catch (error) {
    if ((error as { name?: string })?.name !== "CanceledError") onFailure();
    return null;
  }
};

const tileLayer = (
  id: string,
  getTileData: (request: TileRequest) => Promise<ImageBitmap | null>,
  maxZoom: number,
  opacity: number,
  onViewportLoad?: () => void,
) =>
  new TileLayer({
    id,
    getTileData,
    minZoom: 0,
    // Past this deck.gl scales the maxZoom tiles up rather than asking for
    // finer ones, which is what radar at zoom 8 needs.
    maxZoom,
    tileSize: 256,
    opacity,
    onViewportLoad,
    renderSubLayers: (props) => {
      const { boundingBox } = props.tile;
      return new BitmapLayer(props, {
        data: undefined,
        image: props.data ?? undefined,
        bounds: [
          boundingBox[0][0],
          boundingBox[0][1],
          boundingBox[1][0],
          boundingBox[1][1],
        ],
      });
    },
  });

export default WeatherMap;
