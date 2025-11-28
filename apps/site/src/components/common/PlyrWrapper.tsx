"use client";

import Plyr, {
  type APITypes,
  type PlyrOptions,
  type PlyrSource,
} from "plyr-react";
import React, { type RefObject } from "react";

export interface PlyrProps {
  options: PlyrOptions;
  source: PlyrSource;
  rest?: { [p: string]: any };
  playerRef: RefObject<APITypes>;
}

export const PlyrWrapper: React.FunctionComponent<PlyrProps> = ({
  source,
  options,
  rest,
  playerRef,
}: PlyrProps) => {
  return <Plyr ref={playerRef} source={source} options={options} {...rest} />;
};
export default PlyrWrapper;
