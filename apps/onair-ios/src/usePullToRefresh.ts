import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

/** What letting go does once the pull has gone `at` points past the top. */
export type PullStage = {
  at: number;
  /** What the hint says once the pull is this far: "Release to refresh". */
  label: string;
  /** A promise keeps "Refreshing…" up until it settles. */
  run: () => void | Promise<void>;
};

export type Pull = {
  /** Spread onto the scroll view. */
  scrollProps: {
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle: number;
  };
  /** The scroll offset, for the hint to fade in with. */
  offset: Animated.Value;
  /** The first stage's distance. */
  firstAt: number;
  /** The label for how far the pull has gone. */
  label: string;
  /** Whether the pull has gone far enough to do something on release. */
  armed: boolean;
  /** A stage's promise is still running. */
  busy: boolean;
};

/** The farthest stage a pull of `distance` points has reached, or -1. */
const stageAt = (stages: readonly PullStage[], distance: number): number => {
  let found = -1;
  stages.forEach((stage, index) => {
    if (distance >= stage.at) found = index;
  });
  return found;
};

/**
 * Pull past the top of a scroll view, in stages: the farthest stage reached
 * runs on release. The native RefreshControl draws its spinner at the very
 * top of the scroll view, under the Dynamic Island on a full-bleed screen,
 * so the app draws its own hint (PullHint) where it can be seen.
 */
export const usePullToRefresh = ({
  stages,
  idleLabel,
  onScrollY,
}: {
  /** Nearest first. */
  stages: PullStage[];
  /** What the hint says before the first stage: "Pull to refresh". */
  idleLabel: string;
  /** Every scroll position, for a screen that reacts to scrolling. */
  onScrollY?: (y: number) => void;
}): Pull => {
  const [offset] = useState(() => new Animated.Value(0));
  const [reached, setReached] = useState(-1);
  const [busy, setBusy] = useState(false);
  const latest = useRef({ stages, onScrollY, reached: -1, busy: false });
  useLayoutEffect(() => {
    latest.current.stages = stages;
    latest.current.onScrollY = onScrollY;
    latest.current.busy = busy;
  });

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      offset.setValue(y);
      const index = stageAt(latest.current.stages, -y);
      if (index !== latest.current.reached) {
        latest.current.reached = index;
        setReached(index);
      }
      latest.current.onScrollY?.(y);
    },
    [offset],
  );

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (latest.current.busy) return;
      const { stages: now } = latest.current;
      const stage = now[stageAt(now, -event.nativeEvent.contentOffset.y)];
      if (stage === undefined) return;
      const result = stage.run();
      if (result instanceof Promise) {
        setBusy(true);
        void result.finally(() => setBusy(false));
      }
    },
    [],
  );

  const stage = stages[reached];
  return {
    scrollProps: { onScroll, onScrollEndDrag, scrollEventThrottle: 16 },
    offset,
    firstAt: stages[0]?.at ?? 60,
    label: stage?.label ?? idleLabel,
    armed: stage !== undefined,
    busy,
  };
};
