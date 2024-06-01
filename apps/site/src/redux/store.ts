import { configureStore } from "@reduxjs/toolkit";
import blackCurtainReducer from "./slices/blackCurtainSlice";

export const store = configureStore({
  reducer: {
    blackCurtain: blackCurtainReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
