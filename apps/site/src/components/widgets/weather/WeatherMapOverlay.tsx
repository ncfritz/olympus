import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo } from "react";

export const WeatherMapOverlay = ({ layers }: { layers: any }) => {
  const deck = useMemo(() => new GoogleMapsOverlay({ interleaved: true }), []);

  const map = useMap();
  useEffect(() => deck.setMap(map), [map]);
  useEffect(() => deck.setProps({ layers }), [layers]);

  // no dom rendered by this component
  return null;
};
