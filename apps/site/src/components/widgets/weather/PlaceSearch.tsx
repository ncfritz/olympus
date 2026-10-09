import { type BaseWeatherLocation } from "@ncfritz/olympus-sdk/olympus";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { AutoComplete, Input } from "antd";
import { useEffect, useRef, useState } from "react";
import styles from "./WeatherWidget.module.css";

export interface PlaceSearchProps {
  /** A place was chosen; the caller adds it. */
  onChoose: (place: BaseWeatherLocation) => Promise<void>;
}

const DEBOUNCE_MS = 250;

type Option = {
  value: string;
  label: React.ReactNode;
  prediction: google.maps.places.PlacePrediction;
};

/**
 * Google Places Autocomplete (New), with the site's Maps key (ADR 0024).
 * One session token per search, from the first keystroke to the place
 * chosen, so Google bills a search as one session rather than per request.
 */
const PlaceSearch: React.FunctionComponent<PlaceSearchProps> = ({
  onChoose,
}: PlaceSearchProps) => {
  const places = useMapsLibrary("places");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const session = useRef<
    google.maps.places.AutocompleteSessionToken | undefined
  >(undefined);

  useEffect(() => {
    if (!places || text.trim().length < 2) {
      setOptions([]);
      return;
    }
    session.current ??= new places.AutocompleteSessionToken();
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const { suggestions } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: text,
            sessionToken: session.current,
          });
        if (!current) return;
        setOptions(
          suggestions.flatMap(({ placePrediction }) =>
            placePrediction
              ? [
                  {
                    value: placePrediction.placeId,
                    prediction: placePrediction,
                    label: (
                      <span className={styles.suggestion}>
                        <span>{placePrediction.mainText?.text}</span>
                        <span className={styles.muted}>
                          {placePrediction.secondaryText?.text}
                        </span>
                      </span>
                    ),
                  },
                ]
              : [],
          ),
        );
      } catch {
        if (current) setOptions([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [places, text]);

  const choose = async (option: Option) => {
    setBusy(true);
    try {
      const place = option.prediction.toPlace();
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location"],
      });
      if (!place.location) return;
      await onChoose({
        label: place.displayName ?? option.prediction.text.text,
        placeId: place.id,
        placeName: place.formattedAddress ?? undefined,
        latitude: place.location.lat(),
        longitude: place.location.lng(),
      });
      setText("");
      setOptions([]);
    } finally {
      // The session ends with the place's details; the next search is new.
      session.current = undefined;
      setBusy(false);
    }
  };

  return (
    <AutoComplete
      value={text}
      options={options}
      onChange={setText}
      onSelect={(_value: string, option: Option) => void choose(option)}
      popupRender={(menu) => (
        <>
          {menu}
          <div className={styles.poweredBy}>Powered by Google</div>
        </>
      )}
      disabled={!places || busy}
    >
      <Input.Search
        aria-label="Search for a place to add"
        placeholder="Search for a place"
        loading={busy}
        allowClear
      />
    </AutoComplete>
  );
};

export default PlaceSearch;
