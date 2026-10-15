import { useEffect, useState } from "react";

/** The time, ticking: every second for a countdown, slower for a list. */
export const useNow = (everyMs = 1000): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
};
