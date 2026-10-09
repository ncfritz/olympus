import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  MeetingFilters,
  OverrideFilter,
} from "../../utils/meetingAvailability";
import { loadFromLocalStorage, storeToLocalStorage } from "../../utils/storage";

/**
 * What the meetings pages hide, by calendar and by override status, kept
 * across the day, week and month and across visits.
 */
export type MeetingsState = MeetingFilters;

const defaultState: MeetingsState = {
  hiddenSources: [],
  hiddenStatuses: [],
};

const initialState: MeetingsState = {
  ...defaultState,
  ...loadFromLocalStorage("state.meetings", defaultState),
};

const toggle = <T>(list: T[], item: T): T[] =>
  list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

export const meetingsSlice = createSlice({
  name: "meetings",
  initialState,
  reducers: {
    toggleSourceHidden: (state, action: PayloadAction<string>) => {
      state.hiddenSources = toggle(state.hiddenSources, action.payload);
      storeToLocalStorage("state.meetings", state);
    },
    toggleStatusHidden: (state, action: PayloadAction<OverrideFilter>) => {
      state.hiddenStatuses = toggle(state.hiddenStatuses, action.payload);
      storeToLocalStorage("state.meetings", state);
    },
  },
});

export const { toggleSourceHidden, toggleStatusHidden } = meetingsSlice.actions;

export default meetingsSlice.reducer;
