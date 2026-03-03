import { useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/auth.store";

export function useAuth() {
  const { user, session, isLoading, setUser, setSession, setLoading, clear } = useAuthStore();

  const fetchProfile = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_profile");
    if (error || !data || data.length === 0) {
      setUser(null);
      return;
    }
    setUser(data[0]);
  }, [setUser]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        fetchProfile();
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchProfile();
      } else if (event === "SIGNED_OUT") {
        clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, setSession, setLoading, clear]);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) clear();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  };

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!session,
    isAdmin: user?.role === "admin",
    isPending: user?.status === "pending",
    isApproved: user?.status === "approved",
    signUp,
    signIn,
    signOut,
    resetPassword,
    refreshProfile: fetchProfile,
  };
}
