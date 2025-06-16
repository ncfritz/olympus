import { configureStore } from "@reduxjs/toolkit";
import blackCurtainReducer from "./slices/blackCurtainSlice";
import notificationsReducer from "./slices/notificationsSlice";

export const store = configureStore({
  reducer: {
    blackCurtain: blackCurtainReducer,
    notifications: notificationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
