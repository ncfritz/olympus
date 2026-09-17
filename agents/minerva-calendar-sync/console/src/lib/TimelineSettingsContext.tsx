"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  defaultTimelineSettings,
  loadTimelineSettings,
  saveTimelineSettings,
  type TimelineSettings,
} from "./settings";

interface TimelineSettingsContextValue {
  settings: TimelineSettings;
  updateSettings: (patch: Partial<TimelineSettings>) => void;
}

const TimelineSettingsContext =
  createContext<TimelineSettingsContextValue | null>(null);

/**
 * App-wide (not per-page) since the header's Settings button opens this
 * regardless of which page you're on — see AppLayout.
 */
export function TimelineSettingsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<TimelineSettings>(() =>
    typeof window === "undefined"
      ? defaultTimelineSettings()
      : loadTimelineSettings(),
  );

  function updateSettings(patch: Partial<TimelineSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveTimelineSettings(next);
      return next;
    });
  }

  return (
    <TimelineSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </TimelineSettingsContext.Provider>
  );
}

export function useTimelineSettings(): TimelineSettingsContextValue {
  const ctx = useContext(TimelineSettingsContext);
  if (!ctx) {
    throw new Error(
      "useTimelineSettings must be used within a TimelineSettingsProvider",
    );
  }
  return ctx;
}
