import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DashboardState {
  selectedBranchId: number | null;
}

const initialState: DashboardState = {
  selectedBranchId: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setSelectedBranch: (state, action: PayloadAction<number | null>) => {
      state.selectedBranchId = action.payload;
    },
  },
});

export const { setSelectedBranch } = dashboardSlice.actions;
export default dashboardSlice.reducer;
