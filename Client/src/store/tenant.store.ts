import { create } from "zustand";

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  iconUrl: string | null;
  primaryColor: string;
  primaryHover: string;
  appTitle: string;
  defaultLanguage: string;
}

interface TenantState {
  config: TenantConfig | null;
  isLoading: boolean;
  error: string | null;
  setConfig: (config: TenantConfig) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  config: null,
  isLoading: true,
  error: null,
  setConfig: (config) => set({ config, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
