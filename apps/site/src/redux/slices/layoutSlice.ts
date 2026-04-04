import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { loadFromLocalStorage, storeToLocalStorage } from "../../utils/storage";

interface LayoutState {
  submenuExpanded: boolean;
  expandedTabPanels: Record<string, boolean>;
}

const defaultState: LayoutState = {
  submenuExpanded: true,
  expandedTabPanels: {},
};

const initialState = {
  ...defaultState,
  ...loadFromLocalStorage("state.layout", defaultState),
};

export const layoutSlice = createSlice({
  name: "layout",
  initialState,
  reducers: {
    toggleSubmenuExpanded: (state) => {
      state.submenuExpanded = !state.submenuExpanded;

      storeToLocalStorage("state.layout", state);
    },
    toggleTabPanelExpanded: (
      state,
      action: PayloadAction<string | undefined>,
    ) => {
      if (!action.payload) {
        return;
      }

      const tabs = { ...state.expandedTabPanels };

      tabs[action.payload] = !tabs[action.payload];
      state.expandedTabPanels = tabs;

      storeToLocalStorage("state.layout", state);
    },
    setTabPanelExpanded: (
      state,
      action: PayloadAction<{
        key: string | undefined;
        expanded: boolean | undefined;
      }>,
    ) => {
      const tabs = { ...state.expandedTabPanels };
      const { key, expanded } = action.payload;

      if (!key) {
        return;
      }

      tabs[key] = expanded || false;
      state.expandedTabPanels = tabs;

      storeToLocalStorage("state.layout", state);
    },
  },
});

export const {
  toggleSubmenuExpanded,
  toggleTabPanelExpanded,
  setTabPanelExpanded,
} = layoutSlice.actions;

export default layoutSlice.reducer;
