import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Functions"]["get_my_profile"]["Returns"][number];

interface AuthState {
  user: Profile | null;
  session: Session | null;
  isLoading: boolean;
  setUser: (user: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user) =>
    set({
      user,
      isLoading: false,
    }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () =>
    set({
      user: null,
      session: null,
      isLoading: false,
    }),
}));
