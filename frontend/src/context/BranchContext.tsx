import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAppSelector } from '@/app/hooks';
import type { Branch } from '@/types';

interface BranchContextValue {
  branches: Branch[];
  selectedBranchId: number | null;
  setSelectedBranchId: (id: number) => void;
  selectedBranch: Branch | null;
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  selectedBranchId: null,
  setSelectedBranchId: () => {},
  selectedBranch: null,
});

const BRANCH_STORAGE_KEY = 'selected_branch_id';

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const user = useAppSelector((s) => s.auth.user);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(BRANCH_STORAGE_KEY);
    return stored ? Number(stored) : null;
  });

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    const BASE = import.meta.env.VITE_API_URL || '/api/v1';
    fetch(`${BASE}/salon/branches`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Branch[]) => {
        setBranches(data);
        // Auto-select: if user has a branch, use it; else use stored or first
        if (data.length > 0) {
          const storedId = localStorage.getItem(BRANCH_STORAGE_KEY);
          const storedBranch = storedId ? data.find((b) => b.branch_id === Number(storedId)) : null;
          const userBranch = user?.branch_id ? data.find((b) => b.branch_id === user.branch_id) : null;
          const toSelect = userBranch || storedBranch || data[0];
          if (toSelect) {
            setSelectedBranchIdState(toSelect.branch_id);
            localStorage.setItem(BRANCH_STORAGE_KEY, String(toSelect.branch_id));
          }
        }
      })
      .catch(() => {});
  }, [isAuthenticated, accessToken]);

  const setSelectedBranchId = (id: number) => {
    setSelectedBranchIdState(id);
    localStorage.setItem(BRANCH_STORAGE_KEY, String(id));
  };

  const selectedBranch = branches.find((b) => b.branch_id === selectedBranchId) ?? null;

  return (
    <BranchContext.Provider value={{ branches, selectedBranchId, setSelectedBranchId, selectedBranch }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
