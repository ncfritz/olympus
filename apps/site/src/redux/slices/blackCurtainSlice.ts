import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface BlackCurtainState {
  active: boolean | undefined;
}

const initialState: BlackCurtainState = {
  active: undefined,
};

export const blackCurtainSlice = createSlice({
  name: "blackCurtain",
  initialState,
  reducers: {
    setCurtain: (state, action: PayloadAction<boolean>) => {
      state.active = action.payload;
    },
    toggleCurtain: (state) => {
      state.active = !state.active;
    },
  },
});

export const { setCurtain, toggleCurtain } = blackCurtainSlice.actions;

export default blackCurtainSlice.reducer;
