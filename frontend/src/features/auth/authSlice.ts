import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import type { AuthState, User } from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const storedToken = localStorage.getItem('access_token');

const initialState: AuthState = {
  user: null,
  accessToken: storedToken,
  refreshToken: localStorage.getItem('refresh_token'),
  isAuthenticated: false,
  isInitializing: !!storedToken,
  isLoading: false,
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState }) => {
    const state = getState() as { auth: AuthState };
    try {
      await axios.post(
        `${BASE_URL}/auth/logout`,
        { refresh_token: state.auth.refreshToken },
        { headers: { Authorization: `Bearer ${state.auth.accessToken}` } }
      );
    } catch { /* ignore */ }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
);

export const fetchMe = createAsyncThunk(
  'auth/fetchMe',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };
    try {
      const res = await axios.get(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${state.auth.accessToken}` },
      });
      return res.data;
    } catch (err: any) {
      return rejectWithValue('Session expired');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setTokens: (state, action: PayloadAction<{ access_token: string; refresh_token: string }>) => {
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
      state.isAuthenticated = true;
      localStorage.setItem('access_token', action.payload.access_token);
      localStorage.setItem('refresh_token', action.payload.refresh_token);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.isInitializing = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;
        localStorage.setItem('access_token', action.payload.access_token);
        localStorage.setItem('refresh_token', action.payload.refresh_token);
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
        state.isInitializing = false;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.isAuthenticated = false;
        state.isInitializing = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      });
  },
});

export const { clearError, setTokens } = authSlice.actions;
export default authSlice.reducer;
