import { configureStore } from "@reduxjs/toolkit";
import blackCurtainReducer from "./slices/blackCurtainSlice";
import layoutSliceReducer from "./slices/layoutSlice";
import meetingsReducer from "./slices/meetingsSlice";
import notificationsReducer from "./slices/notificationsSlice";

export const store = configureStore({
  reducer: {
    blackCurtain: blackCurtainReducer,
    notifications: notificationsReducer,
    layout: layoutSliceReducer,
    meetings: meetingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
