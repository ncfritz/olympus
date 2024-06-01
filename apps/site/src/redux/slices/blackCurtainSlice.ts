import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface BlackCurtainState {
  active: boolean;
}

const initialState: BlackCurtainState = {
  active: true,
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
