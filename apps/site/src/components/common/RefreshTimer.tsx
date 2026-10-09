import React, { type ReactNode, useEffect, useMemo, useState } from "react";

interface RefreshTimerProps {
  ttlMs: number;
  tickInterval?: number;
  fetchFunction: () => Promise<void>;
  showProgress?: boolean;
  renderProgress?: (progress: number) => ReactNode;
  disabled?: boolean;
  children?: ReactNode | ReactNode[];
}

const RefreshTimer: React.FunctionComponent<RefreshTimerProps> = ({
  ttlMs,
  tickInterval = 1000,
  fetchFunction,
  showProgress = true,
  renderProgress,
  disabled = false,
}: RefreshTimerProps) => {
  const [percent, setPercent] = useState(100);

  const initializedTime = useMemo(() => {
    return new Date().getTime();
  }, []);

  let timer: NodeJS.Timeout | undefined = undefined;
  let dataLastFetched = new Date().getTime();

  const handler = () => {
    const now = new Date().getTime();
    const timeSinceInitialization = now - initializedTime;
    const timeSinceLastFetch = now - dataLastFetched;
    const currentPercent = Math.max(
      ((ttlMs - timeSinceLastFetch) / ttlMs) * 100,
      0,
    );

    setPercent(currentPercent);

    //console.log(
    //  `Now: ${now} - dataLastFetched: ${dataLastFetched} - timeSinceLastFetch: ${timeSinceLastFetch} - percent: ${currentPercent} - TTL: ${ttlMs}`,
    //);

    if (timeSinceInitialization >= ttlMs && timeSinceLastFetch >= ttlMs) {
      try {
        (async () => {
          await fetchFunction();
        })();

        dataLastFetched = now;
        setPercent(100);
      } catch (e) {
        console.log(e);
      }
    }
  };

  useEffect(() => {
    if (disabled) {
      return;
    }

    if (!timer) {
      timer = setInterval(handler, tickInterval);
      console.log(`RefreshTimer created interval ${timer}`);
    }

    return () => {
      if (timer) {
        console.log(`RefreshTimer tearing down interval ${timer}`);
        clearTimeout(timer);
      }
    };
  }, []);

  let content: React.ReactNode = <></>;

  if (showProgress && !disabled) {
    if (renderProgress) {
      content = renderProgress(percent);
    } else {
      content = (
        <div
          style={{
            height: 1,
            backgroundColor: "#ffffff",
            borderColor: "#f3f3f3",
            borderStyle: "solid",
            borderWidth: "0px 1px",
            width: "100%",
          }}
        >
          <div
            style={{
              height: "100%",
              backgroundColor: "#dedede",
              width: `${percent}%`,
              transition: "width 0.9s ease-out",
            }}
          ></div>
        </div>
      );
    }
  }

  return content;
};
export default RefreshTimer;
