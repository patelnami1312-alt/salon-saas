import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from '@/features/auth/authSlice';
import dashboardReducer from '@/features/dashboard/dashboardSlice';
import { apiSlice } from '@/features/api/apiSlice';
import { adminApiSlice } from '@/features/api/adminApiSlice';

// Exported so tests can create isolated fresh stores with preloadedState
export function makeStore(preloadedState?: Parameters<typeof configureStore>[0]['preloadedState']) {
  return configureStore({
    reducer: {
      auth: authReducer,
      dashboard: dashboardReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
      [adminApiSlice.reducerPath]: adminApiSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false })
        .concat(apiSlice.middleware)
        .concat(adminApiSlice.middleware),
    preloadedState,
  });
}

export const store = makeStore();

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
